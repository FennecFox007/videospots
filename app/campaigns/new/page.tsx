import { eq } from "drizzle-orm";
import { CampaignFormBody } from "@/components/campaign-form-body";
import { getChannelGroups } from "@/lib/db/queries";
import { db, campaignTemplates } from "@/lib/db/client";
import { addDays } from "@/lib/utils";
import { createCampaign } from "./actions";
import type { TemplatePayload } from "@/app/admin/templates/actions";

type SearchParams = {
  template?: string;
  /** Comma-separated channel IDs to pre-select. Used by timeline right-click. */
  channels?: string;
  /** ISO YYYY-MM-DD pre-fill for the date inputs. */
  from?: string;
  to?: string;
};

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const groups = await getChannelGroups();

  // Layered defaults: template (broad) → URL channel/date overrides (narrow).

  // 1) Template
  let defaults: Parameters<typeof CampaignFormBody>[0]["defaults"] = undefined;
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
        videoUrl: p.videoUrl,
        color: p.color,
        tags: p.tags,
        startsAt: today,
        endsAt: addDays(today, Math.max(1, p.durationDays - 1)),
        notes: p.notes,
        game: p.game
          ? {
              name: p.game.name,
              releaseDate: p.game.releaseDate
                ? new Date(p.game.releaseDate)
                : null,
              coverUrl: p.game.coverUrl,
              summary: p.game.summary,
            }
          : null,
        channelIds: new Set(p.channelIds),
      };
    }
  }

  // 2) URL overrides (?channels=, ?from=, ?to=) — used by timeline right-click
  // "create campaign here". Layered on top so they win over template values.
  const explicitChannels = (params.channels ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const explicitFrom = parseDateParam(params.from);
  const explicitTo = parseDateParam(params.to);

  if (
    explicitChannels.length > 0 ||
    explicitFrom !== null ||
    explicitTo !== null
  ) {
    defaults = {
      ...(defaults ?? {}),
      ...(explicitChannels.length > 0
        ? { channelIds: new Set(explicitChannels) }
        : {}),
      ...(explicitFrom ? { startsAt: explicitFrom } : {}),
      ...(explicitTo ? { endsAt: explicitTo } : {}),
    };
  }

  // Hint text that makes it clear what got pre-filled.
  let hint: React.ReactNode =
    "Naplánuj video spot na vybrané kanály v zadaném období.";
  if (templateName) {
    hint = (
      <>
        Předvyplněno ze šablony{" "}
        <span className="font-medium">„{templateName}"</span>.
      </>
    );
  } else if (explicitChannels.length > 0 || explicitFrom) {
    hint = "Předvyplněno z timeline (kanály a/nebo datumy).";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Nová kampaň
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{hint}</p>

      <form action={createCampaign} className="space-y-6">
        <CampaignFormBody
          groups={groups}
          defaults={defaults}
          submitLabel="Vytvořit kampaň"
          cancelHref="/"
          showRecurring
        />
      </form>
    </div>
  );
}
