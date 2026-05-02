import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  games,
} from "@/lib/db/client";
import { CampaignFormBody } from "@/components/campaign-form-body";
import { getChannelGroups } from "@/lib/db/queries";
import { updateCampaign } from "./actions";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .leftJoin(games, eq(campaigns.gameId, games.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!row) notFound();

  const channelRows = await db
    .select({ channelId: campaignChannels.channelId })
    .from(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId));

  const groups = await getChannelGroups();

  const action = updateCampaign.bind(null, campaignId);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Upravit kampaň
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        {row.campaign.name}
      </p>

      <form action={action} className="space-y-6">
        <CampaignFormBody
          groups={groups}
          defaults={{
            name: row.campaign.name,
            client: row.campaign.client,
            videoUrl: row.campaign.videoUrl,
            color: row.campaign.color,
            status: row.campaign.status,
            tags: row.campaign.tags,
            startsAt: row.campaign.startsAt,
            endsAt: row.campaign.endsAt,
            notes: row.campaign.notes,
            game: row.game
              ? {
                  name: row.game.name,
                  releaseDate: row.game.releaseDate,
                  coverUrl: row.game.coverUrl,
                  summary: row.game.summary,
                }
              : null,
            channelIds: new Set(channelRows.map((r) => r.channelId)),
          }}
          submitLabel="Uložit změny"
          cancelHref={`/campaigns/${campaignId}`}
        />
      </form>
    </div>
  );
}
