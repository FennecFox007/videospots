import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  products,
} from "@/lib/db/client";
import { CampaignFormBody } from "@/components/campaign-form-body";
import { getChannelGroups } from "@/lib/db/queries";
import { updateCampaign } from "./actions";
import { getT } from "@/lib/i18n/server";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({ campaign: campaigns, product: products })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!row) notFound();

  const channelRows = await db
    .select({ channelId: campaignChannels.channelId })
    .from(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId));

  const videoRows = await db
    .select({
      countryId: campaignVideos.countryId,
      videoUrl: campaignVideos.videoUrl,
    })
    .from(campaignVideos)
    .where(eq(campaignVideos.campaignId, campaignId));
  const videosByCountry: Record<number, string> = {};
  for (const v of videoRows) videosByCountry[v.countryId] = v.videoUrl;

  const groups = await getChannelGroups();
  const t = await getT();

  const action = updateCampaign.bind(null, campaignId);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">
        {t("form.edit_campaign_title")}
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
            videosByCountry,
            color: row.campaign.color,
            status: row.campaign.status,
            communicationType: row.campaign.communicationType,
            tags: row.campaign.tags,
            startsAt: row.campaign.startsAt,
            endsAt: row.campaign.endsAt,
            notes: row.campaign.notes,
            product: row.product
              ? {
                  name: row.product.name,
                  kind: row.product.kind,
                  releaseDate: row.product.releaseDate,
                  coverUrl: row.product.coverUrl,
                  summary: row.product.summary,
                }
              : null,
            channelIds: new Set(channelRows.map((r) => r.channelId)),
          }}
          submitLabel={t("form.submit_save")}
          cancelHref={`/campaigns/${campaignId}`}
        />
      </form>
    </div>
  );
}
