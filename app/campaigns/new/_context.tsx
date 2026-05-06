// Shared loader for both the standalone /campaigns/new page and the
// intercepting-route modal version (app/@modal/(.)campaigns/new). Folder
// starts with `_` so Next doesn't treat it as a route segment.

import { eq } from "drizzle-orm";
import { db, campaignTemplates } from "@/lib/db/client";
import { addDays } from "@/lib/utils";
import { getChannelGroups } from "@/lib/db/queries";
import type { CampaignFormBody } from "@/components/campaign-form-body";
import type { TemplatePayload } from "@/app/admin/templates/actions";
import { getT } from "@/lib/i18n/server";

export type NewCampaignSearchParams = {
  template?: string;
  /** Comma-separated channel IDs to pre-select. Used by timeline right-click. */
  channels?: string;
  /** ISO YYYY-MM-DD pre-fill for the date inputs. */
  from?: string;
  to?: string;
  /** Pre-fill product name (used by /releases "Launch spot" buttons). */
  productName?: string;
  /** Pre-fill communication type (e.g. "launch", "preorder"). */
  communicationType?: string;
};

type CampaignFormDefaults = Parameters<
  typeof CampaignFormBody
>[0]["defaults"];

export type NewCampaignContext = {
  groups: Awaited<ReturnType<typeof getChannelGroups>>;
  defaults: CampaignFormDefaults;
  hint: React.ReactNode;
  templateName: string | null;
};

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Build the form-defaults / hint text from URL params + (optionally) a saved
 * template. Layered: template (broad) → URL channel/date overrides (narrow)
 * → release-calendar prefill (narrowest).
 */
export async function loadNewCampaignContext(
  params: NewCampaignSearchParams
): Promise<NewCampaignContext> {
  const groups = await getChannelGroups();

  // 1) Template
  let defaults: CampaignFormDefaults = undefined;
  let templateName: string | null = null;
  const templateId = Number(params.template);
  if (Number.isFinite(templateId) && templateId > 0) {
    const [t] = await db
      .select()
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, templateId))
      .limit(1);
    if (t) {
      templateName = t.name;
      const p = t.payload as TemplatePayload;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      defaults = {
        name: t.name,
        client: p.client,
        // Templates carry a single legacy videoUrl; we don't migrate it
        // automatically — the user picks per-country videos for each new
        // campaign. (Old templates' videoUrl is essentially ignored.)
        color: p.color,
        tags: p.tags,
        startsAt: today,
        endsAt: addDays(today, Math.max(1, p.durationDays - 1)),
        notes: p.notes,
        product: p.product
          ? {
              name: p.product.name,
              kind: p.product.kind,
              releaseDate: p.product.releaseDate
                ? new Date(p.product.releaseDate)
                : null,
              coverUrl: p.product.coverUrl,
              summary: p.product.summary,
            }
          : null,
        channelIds: new Set(p.channelIds),
      };
    }
  }

  // 2) URL overrides
  const explicitChannels = (params.channels ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const explicitFrom = parseDateParam(params.from);
  const explicitTo = parseDateParam(params.to);
  const productNameParam = (params.productName ?? "").trim();
  const commTypeParam = (params.communicationType ?? "").trim();

  if (
    explicitChannels.length > 0 ||
    explicitFrom !== null ||
    explicitTo !== null ||
    productNameParam ||
    commTypeParam
  ) {
    defaults = {
      ...(defaults ?? {}),
      ...(explicitChannels.length > 0
        ? { channelIds: new Set(explicitChannels) }
        : {}),
      ...(explicitFrom ? { startsAt: explicitFrom } : {}),
      ...(explicitTo ? { endsAt: explicitTo } : {}),
      ...(commTypeParam ? { communicationType: commTypeParam } : {}),
      ...(productNameParam
        ? { product: { ...(defaults?.product ?? {}), name: productNameParam } }
        : {}),
    };
  }

  // Hint text that makes it clear what got pre-filled.
  const tt = await getT();
  let hint: React.ReactNode = tt("form.hint_default");
  if (templateName) {
    hint = tt("form.hint_template", { name: templateName });
  } else if (productNameParam) {
    hint = tt("form.hint_release", { name: productNameParam });
  } else if (explicitChannels.length > 0 || explicitFrom) {
    hint = tt("form.hint_timeline");
  }

  return { groups, defaults, hint, templateName };
}
