// Public approval endpoint — called from the share view's "Schvaluji" button.
// No login required: holding a valid share token IS the authorisation.
//
// Body: { campaignId: number, comment?: string }
//
// The token must (a) exist, (b) not be expired, and (c) actually grant
// access to this campaign — either it's a campaign-scoped token for that
// id, or it's a timeline token whose filter range happens to include the
// campaign's dates. We don't try to be clever here: the simplest "client
// has the link, client can see this campaign on the page they're on" check
// is enough for v1.
//
// "Permanent approval" semantics by design (per partner): once approved,
// approvedAt stays. Subsequent campaign edits don't invalidate it. If we
// ever need re-approval after edit, that becomes a v2 schema change
// (approvalSnapshot, approval history, etc.).

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  db,
  campaigns,
  shareLinks,
  auditLog,
} from "@/lib/db/client";

type SharePayload =
  | { type: "campaign"; campaignId: number }
  | { type: "timeline"; filters?: Record<string, string> };

const MAX_COMMENT_LENGTH = 2000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: { campaignId?: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const campaignId = Number(body.campaignId);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json(
      { error: "Missing campaignId" },
      { status: 400 }
    );
  }
  const comment =
    typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: "Comment too long" },
      { status: 400 }
    );
  }

  // Token validity. Same check the share page itself does.
  const now = new Date();
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now))!
      )
    )
    .limit(1);
  if (!link) {
    return NextResponse.json(
      { error: "Token not found or expired" },
      { status: 404 }
    );
  }

  const payload = link.payload as SharePayload;
  // Trust check: campaign-scoped token must reference this exact id.
  // Timeline-scoped tokens are intentionally permissive — anyone with the
  // timeline link can see (and therefore approve) any campaign that
  // appears on it. A v2 hardening could replay the filter to verify the
  // campaign actually shows on the timeline; the trade-off isn't worth
  // it for v1 with a small, trusted set of clients.
  if (payload.type === "campaign" && payload.campaignId !== campaignId) {
    return NextResponse.json(
      { error: "Token does not authorize this campaign" },
      { status: 403 }
    );
  }

  // Find the campaign. (Could in theory be archived; we still allow
  // approving — if the agency archived something the client is reviewing,
  // letting them say "yes" doesn't hurt and keeps the audit trail honest.)
  const [campaign] = await db
    .select({
      id: campaigns.id,
      clientApprovedAt: campaigns.clientApprovedAt,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 }
    );
  }

  // Idempotent: if already approved, just echo back the existing timestamp.
  // This way an accidental double-click doesn't bump the date forward.
  if (campaign.clientApprovedAt) {
    return NextResponse.json({
      approvedAt: campaign.clientApprovedAt.toISOString(),
      alreadyApproved: true,
    });
  }

  const approvedAt = new Date();
  await db
    .update(campaigns)
    .set({
      clientApprovedAt: approvedAt,
      clientApprovedComment: comment || null,
      updatedAt: approvedAt,
    })
    .where(eq(campaigns.id, campaignId));

  // Audit log entry — userId stays null because this is a public action by
  // someone holding the share link. The token is recorded in `changes` so
  // we can trace which link was used.
  await db.insert(auditLog).values({
    action: "approved",
    entity: "campaign",
    entityId: campaignId,
    userId: null,
    changes: {
      via: "share-link",
      token,
      comment: comment || null,
    },
  });

  return NextResponse.json({
    approvedAt: approvedAt.toISOString(),
    alreadyApproved: false,
  });
}
