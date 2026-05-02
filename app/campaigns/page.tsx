import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  products,
} from "@/lib/db/client";
import { FilterBar } from "@/components/filter-bar";
import { CampaignsTable } from "@/components/campaigns-table";
import type { CampaignsTableRow } from "@/components/campaigns-table";
import { daysBetween, pluralCs } from "@/lib/utils";
import { findCampaignIds, getFilterOptions } from "@/lib/db/queries";

type SearchParams = {
  q?: string;
  country?: string;
  chain?: string;
  client?: string;
  status?: string;
  runState?: string;
  tag?: string;
  communicationType?: string;
  sort?: string; // "starts" | "name" | "client" | "status" | "duration"
  order?: string; // "asc" | "desc"
};

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sort = params.sort ?? "starts";
  const order = params.order === "asc" ? "asc" : "desc";

  const matchingIds = await findCampaignIds({
    q: params.q,
    countryCode: params.country,
    chainCode: params.chain,
    client: params.client,
    status: params.status,
    runState: params.runState,
    communicationType: params.communicationType,
    tag: params.tag,
  });

  const rawRows =
    matchingIds.length === 0
      ? []
      : await db
          .select({ campaign: campaigns, product: products })
          .from(campaigns)
          .leftJoin(products, eq(campaigns.productId, products.id))
          .where(inArray(campaigns.id, matchingIds));

  // Channel counts per campaign (single grouped query).
  const channelCounts =
    matchingIds.length === 0
      ? []
      : await db
          .select({
            campaignId: campaignChannels.campaignId,
            count: sql<number>`count(*)::int`,
          })
          .from(campaignChannels)
          .where(inArray(campaignChannels.campaignId, matchingIds))
          .groupBy(campaignChannels.campaignId);
  const countByCampaign = new Map(
    channelCounts.map((r) => [r.campaignId, r.count])
  );

  // Pack into the shape CampaignsTable wants, then sort.
  const rows: CampaignsTableRow[] = rawRows.map(({ campaign, product }) => ({
    id: campaign.id,
    name: campaign.name,
    client: campaign.client,
    productName: product?.name ?? null,
    productKind: product?.kind ?? null,
    productReleaseDate: product?.releaseDate ?? null,
    color: campaign.color,
    status: campaign.status,
    communicationType: campaign.communicationType,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    channelCount: countByCampaign.get(campaign.id) ?? 0,
    tags: campaign.tags,
  }));

  rows.sort((a, b) => {
    const dir = order === "asc" ? 1 : -1;
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "client":
        return (a.client ?? "").localeCompare(b.client ?? "") * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "duration": {
        const da = daysBetween(a.startsAt, a.endsAt);
        const db = daysBetween(b.startsAt, b.endsAt);
        return (da - db) * dir;
      }
      case "starts":
      default:
        return (a.startsAt.getTime() - b.startsAt.getTime()) * dir;
    }
  });

  const filterOpts = await getFilterOptions();

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-4 pb-20">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Seznam kampaní
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {rows.length}{" "}
            {pluralCs(rows.length, "kampaň", "kampaně", "kampaní")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Timeline
          </Link>
          <ExportCsvLink params={params} />
          <Link
            href="/campaigns/new"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            + Nová kampaň
          </Link>
        </div>
      </div>

      <FilterBar
        countries={filterOpts.countries}
        chains={filterOpts.chains}
        clients={filterOpts.clients}
        tags={filterOpts.tags}
      />

      <p className="text-xs text-zinc-500">
        Vyber kampaně levým checkboxem; spodní lišta nabídne hromadné akce
        (smazat / zrušit / změnit barvu).
      </p>

      <CampaignsTable
        rows={rows}
        params={params}
        sort={sort}
        order={order}
      />
    </div>
  );
}

function ExportCsvLink({ params }: { params: SearchParams }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "sort" || k === "order") continue;
    if (typeof v === "string" && v) sp.set(k, v);
  }
  const href =
    sp.size > 0 ? `/api/export/campaigns?${sp}` : "/api/export/campaigns";
  return (
    <a
      href={href}
      download
      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
      title="Stáhnout filtrovaný seznam jako CSV"
    >
      Export CSV
    </a>
  );
}
