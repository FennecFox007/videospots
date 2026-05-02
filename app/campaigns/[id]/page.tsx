import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, asc, desc } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  channels,
  countries,
  chains,
  products,
  comments,
  users,
  auditLog,
} from "@/lib/db/client";
import { kindLabel, kindEmoji } from "@/lib/products";
import { auth } from "@/auth";
import {
  formatDate,
  daysBetween,
  pluralCs,
  computedRunState,
  formatRelative,
} from "@/lib/utils";
import {
  archiveCampaign,
  cloneCampaign,
  cancelCampaign,
  reactivateCampaign,
  addComment,
  deleteComment,
} from "./actions";
import { StatusBadge } from "@/components/status-badge";
import { ShareButton } from "@/components/share-button";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";
import { EditableCampaignTitle } from "@/components/editable-campaign-title";
import { CommunicationBadge } from "@/components/communication-badge";
import { VideoEmbed } from "@/components/video-embed";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({
      campaign: campaigns,
      product: products,
    })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!row) notFound();

  const channelRows = await db
    .select({
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
    })
    .from(campaignChannels)
    .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id))
    .where(eq(campaignChannels.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder), asc(chains.sortOrder));

  const c = row.campaign;
  const product = row.product;
  const runState = computedRunState(c);

  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.campaignId, campaignId))
    .orderBy(asc(comments.createdAt));

  const historyRows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(
      and(eq(auditLog.entity, "campaign"), eq(auditLog.entityId, campaignId))
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(50);

  // List of usernames/emails for @mention highlighting in comments.
  const knownHandles = await db
    .selectDistinct({ name: users.name, email: users.email })
    .from(users);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Timeline
          </Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className="inline-block w-4 h-4 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
              style={{ background: c.color }}
              aria-label="Barva v timeline"
            />
            <EditableCampaignTitle
              campaignId={campaignId}
              initialName={c.name}
            />
            <StatusBadge status={c.status} runState={runState} />
            <CommunicationBadge type={c.communicationType} />
          </div>
          {c.client && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {c.client}
            </p>
          )}
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.tags.map((t) => (
                <Link
                  key={t}
                  href={`/campaigns?tag=${encodeURIComponent(t)}`}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}
          {c.notes && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 italic max-w-2xl line-clamp-3 whitespace-pre-wrap">
              {c.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {c.status !== "cancelled" ? (
            <form
              action={async () => {
                "use server";
                await cancelCampaign(campaignId);
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                Zrušit (historicky)
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await reactivateCampaign(campaignId);
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                Obnovit
              </button>
            </form>
          )}
          <Link
            href={`/campaigns/${campaignId}/edit`}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Upravit
          </Link>
          <form
            action={async () => {
              "use server";
              await cloneCampaign(campaignId);
            }}
          >
            <button
              type="submit"
              className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Klonovat
            </button>
          </form>
          <ShareButton campaignId={campaignId} />
          <SaveAsTemplateButton
            campaignId={campaignId}
            defaultName={c.name}
          />
          <a
            href={`/print/campaigns/${campaignId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title="Otevřít v tiskové podobě (Ctrl+P → uložit jako PDF)"
          >
            Tisk / PDF
          </a>
          <form
            action={async () => {
              "use server";
              await archiveCampaign(campaignId);
            }}
          >
            <button
              type="submit"
              className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 dark:border-red-900/50 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Přesunout do archivu (lze obnovit)"
            >
              Archivovat
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card label="Začátek">{formatDate(c.startsAt)}</Card>
        <Card label="Konec">{formatDate(c.endsAt)}</Card>
        <Card label="Délka">
          {(() => {
            const d = daysBetween(c.startsAt, c.endsAt);
            return `${d} ${pluralCs(d, "den", "dny", "dní")}`;
          })()}
        </Card>
        <Card label="Total reach">
          {(() => {
            const d = daysBetween(c.startsAt, c.endsAt);
            const sd = d * channelRows.length;
            return (
              <span>
                {sd}{" "}
                <span className="text-xs text-zinc-500 font-normal">
                  screen-days · {channelRows.length} ×{" "}
                  {pluralCs(d, "den", "dny", "dní")}
                </span>
              </span>
            );
          })()}
        </Card>
      </div>

      {product && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <h2 className="font-medium mb-3">Produkt</h2>
          <div className="flex items-start gap-4">
            {product.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.coverUrl}
                alt={product.name}
                className="w-24 h-32 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{product.name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <span aria-hidden>{kindEmoji(product.kind)}</span>
                  {kindLabel(product.kind)}
                </span>
              </div>
              {product.releaseDate && (
                <div className="text-sm text-zinc-500 mt-0.5">
                  Vyšlo {formatDate(product.releaseDate)}
                </div>
              )}
              {product.summary && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                  {product.summary}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {c.videoUrl && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <h2 className="font-medium mb-3">Video</h2>
          <VideoEmbed url={c.videoUrl} />
        </div>
      )}

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          Kanály ({channelRows.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {channelRows.map((ch, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-sm"
            >
              <span>{ch.countryFlag}</span>
              <span className="text-zinc-500">{ch.countryName}</span>
              <span>·</span>
              <span>{ch.chainName}</span>
            </span>
          ))}
          {channelRows.length === 0 && (
            <p className="text-sm text-zinc-500">Žádné kanály.</p>
          )}
        </div>
      </div>

      {c.notes && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <h2 className="font-medium mb-2">Poznámky</h2>
          <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {c.notes}
          </p>
        </div>
      )}

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          Komentáře ({commentRows.length})
        </h2>

        {commentRows.length > 0 && (
          <ul className="space-y-3 mb-4">
            {commentRows.map((cm) => (
              <li
                key={cm.id}
                className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {cm.userName ?? cm.userEmail ?? "smazaný uživatel"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatRelative(cm.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {renderCommentBody(cm.body, knownHandles)}
                </p>
                {cm.userId === currentUserId && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteComment(cm.id);
                    }}
                    className="mt-1"
                  >
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-red-600"
                    >
                      Smazat
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={addComment.bind(null, campaignId)} className="space-y-2">
          <textarea
            name="body"
            required
            rows={2}
            maxLength={2000}
            placeholder="Napsat komentář…  (zmíň kolegu přes @username)"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
            >
              Přidat komentář
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          Historie změn ({historyRows.length})
        </h2>
        {historyRows.length === 0 ? (
          <p className="text-sm text-zinc-500">Žádná historie.</p>
        ) : (
          <ul className="space-y-1.5">
            {historyRows.map((h) => (
              <li
                key={h.id}
                className="text-sm text-zinc-600 dark:text-zinc-400 flex items-baseline gap-2 flex-wrap"
              >
                <span className="text-xs text-zinc-500 w-24 shrink-0">
                  {formatRelative(h.createdAt)}
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {h.userName ?? h.userEmail ?? "?"}
                </span>
                <span className="leading-snug">
                  {humanizeAuditEntry(h.action, h.changes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Render a single audit-log entry as a Czech sentence. Handles two storage
 * shapes side by side, since we changed the format and old rows still live in
 * the DB:
 *
 * - **Diff** (newer): `{ name: { from: "X", to: "Y" }, … }` — render as
 *   "upravil(a) — název X → Y, kanálů 6 → 7".
 * - **Snapshot** (older): `{ name: "X", channelCount: 6 }` — flat values,
 *   render as "upravil(a) — kampaň 'X', 6 kanálů".
 *
 * Special-case shapes from the various server actions (drag-channel,
 * timeline-drag, rename, reactivate, clone, etc.) are detected first so the
 * sentence stays short.
 */
function humanizeAuditEntry(action: string, changes: unknown): React.ReactNode {
  const obj =
    changes && typeof changes === "object"
      ? (changes as Record<string, unknown>)
      : null;

  // Action-led summaries — these have no useful detail beyond the verb.
  if (action === "cancelled") return "zrušil(a) kampaň";
  if (action === "archived") return "archivoval(a) kampaň";
  if (action === "deleted") {
    const name = obj && typeof obj.name === "string" ? obj.name : null;
    return name ? (
      <>smazal(a) kampaň „{name}"</>
    ) : (
      "smazal(a) kampaň"
    );
  }

  if (action === "created") {
    if (obj && typeof obj.clonedFrom === "number") {
      return <>vytvořil(a) kampaň naklonováním z #{obj.clonedFrom}</>;
    }
    if (obj && typeof obj.series === "string") {
      return <>vytvořil(a) kampaň (série {String(obj.series)})</>;
    }
    return "vytvořil(a) kampaň";
  }

  // Specific edit shapes
  if (obj && obj.via === "timeline-drag-channel") {
    const from = obj.from;
    const to = obj.to;
    return (
      <>
        přesunul(a) kampaň na jiný kanál
        {typeof from === "number" && typeof to === "number" && (
          <span className="text-xs text-zinc-500 ml-1">
            (#{from} → #{to})
          </span>
        )}
      </>
    );
  }
  if (obj && obj.unarchived === true) return "obnovil(a) z archivu";
  if (obj && obj.reactivated === true) return "obnovil(a) zrušenou kampaň";
  if (obj && obj.renamed && isDiff(obj.renamed)) {
    return (
      <>
        přejmenoval(a) z „{String(obj.renamed.from)}" na „
        {String(obj.renamed.to)}"
      </>
    );
  }

  // Generic update — walk the change object, building a list of
  // "field: from → to" or "field: value" depending on shape.
  if (action === "updated" && obj) {
    const parts: React.ReactNode[] = [];
    let key = 0;
    for (const [field, value] of Object.entries(obj)) {
      if (field === "via") continue; // skip metadata keys
      const label = AUDIT_FIELD_LABEL[field];
      if (!label) continue; // unknown key — skip rather than render gibberish
      if (isDiff(value)) {
        parts.push(
          <span key={key++} className="whitespace-nowrap">
            {label}: {formatAuditValue(field, value.from)}{" "}
            <span className="text-zinc-400">→</span>{" "}
            {formatAuditValue(field, value.to)}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className="whitespace-nowrap">
            {label}: {formatAuditValue(field, value)}
          </span>
        );
      }
    }
    if (parts.length === 0) return "upravil(a) kampaň";
    const joined: React.ReactNode[] = [];
    parts.forEach((p, i) => {
      if (i > 0) joined.push(<span key={`sep-${i}`}>, </span>);
      joined.push(p);
    });
    return (
      <>
        upravil(a) — <span className="text-zinc-500">{joined}</span>
      </>
    );
  }

  return action;
}

const AUDIT_FIELD_LABEL: Record<string, string> = {
  name: "název",
  client: "klient",
  videoUrl: "video",
  color: "barva",
  status: "stav",
  communicationType: "typ",
  notes: "poznámka",
  tags: "štítky",
  startsAt: "začátek",
  endsAt: "konec",
  productName: "produkt",
  channels: "kanály",
  channelCount: "kanálů",
};

function isDiff(v: unknown): v is { from: unknown; to: unknown } {
  return (
    !!v &&
    typeof v === "object" &&
    "from" in (v as object) &&
    "to" in (v as object)
  );
}

function formatAuditValue(field: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-zinc-400 italic">—</span>;
  }
  if (field === "startsAt" || field === "endsAt") {
    if (value instanceof Date) return formatDate(value);
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return formatDate(d);
    }
  }
  if (field === "status") {
    return value === "approved"
      ? "Aktivní"
      : value === "cancelled"
        ? "Zrušeno"
        : String(value);
  }
  if (field === "tags" && Array.isArray(value)) {
    return value.length === 0 ? (
      <span className="text-zinc-400 italic">žádné</span>
    ) : (
      value.map((t) => `#${t}`).join(", ")
    );
  }
  if (field === "channels" && Array.isArray(value)) {
    return `${value.length} kanálů`;
  }
  if (field === "color" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block w-2 h-2 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-600"
          style={{ background: value }}
        />
        <span className="font-mono text-[10px]">{value}</span>
      </span>
    );
  }
  if (typeof value === "string") {
    if (value.length > 40) return `„${value.slice(0, 39)}…"`;
    return `„${value}"`;
  }
  return String(value);
}

/**
 * Render comment body with @mentions visually highlighted. Mentions match a
 * known username or email (substring before @, or the whole label) — anything
 * else stays plain text.
 */
function renderCommentBody(
  body: string,
  knownHandles: { name: string | null; email: string }[]
): React.ReactNode {
  const handleSet = new Set<string>();
  for (const h of knownHandles) {
    if (h.email) handleSet.add(h.email.toLowerCase());
    if (h.name) handleSet.add(h.name.toLowerCase());
    // also bare local-part of email ("petr@firma.cz" → "petr")
    const local = h.email?.split("@")[0]?.toLowerCase();
    if (local) handleSet.add(local);
  }
  // Tokenize on @ followed by non-whitespace.
  const re = /(@[\w.\-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    const handle = match[1].slice(1).toLowerCase();
    const known = handleSet.has(handle);
    parts.push(
      <span
        key={`m-${i++}`}
        className={
          known
            ? "rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1 font-medium"
            : "text-zinc-500"
        }
      >
        {match[1]}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-base font-medium">{children}</div>
    </div>
  );
}

