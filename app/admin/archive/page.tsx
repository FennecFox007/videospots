import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  products,
} from "@/lib/db/client";
import { findCampaignIds } from "@/lib/db/queries";
import {
  formatDate,
  daysBetween,
  pluralCs,
  formatRelative,
} from "@/lib/utils";
import {
  unarchiveCampaign,
  deleteCampaign,
} from "@/app/campaigns/[id]/actions";

export default async function ArchivePage() {
  const ids = await findCampaignIds({ onlyArchived: true });

  const rows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            client: campaigns.client,
            color: campaigns.color,
            startsAt: campaigns.startsAt,
            endsAt: campaigns.endsAt,
            archivedAt: campaigns.archivedAt,
            productName: products.name,
          })
          .from(campaigns)
          .leftJoin(products, eq(campaigns.productId, products.id))
          .where(inArray(campaigns.id, ids));

  const channelCounts =
    ids.length === 0
      ? []
      : await db
          .select({
            campaignId: campaignChannels.campaignId,
            count: sql<number>`count(*)::int`,
          })
          .from(campaignChannels)
          .where(inArray(campaignChannels.campaignId, ids))
          .groupBy(campaignChannels.campaignId);
  const countByCampaign = new Map(
    channelCounts.map((r) => [r.campaignId, r.count])
  );

  rows.sort((a, b) => {
    const aT = a.archivedAt?.getTime() ?? 0;
    const bT = b.archivedAt?.getTime() ?? 0;
    return bT - aT;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Archivované kampaně ({rows.length}) — z běžného přehledu skryté, ale
        stále v DB. Můžeš je obnovit zpět, nebo definitivně smazat.
      </p>

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-3 py-2 w-6"></th>
              <th className="px-3 py-2 font-medium">Kampaň</th>
              <th className="px-3 py-2 font-medium">Klient</th>
              <th className="px-3 py-2 font-medium">Hra</th>
              <th className="px-3 py-2 font-medium">Termín</th>
              <th className="px-3 py-2 font-medium text-right">Kanály</th>
              <th className="px-3 py-2 font-medium">Archivováno</th>
              <th className="px-3 py-2 font-medium w-48">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dur = daysBetween(r.startsAt, r.endsAt);
              return (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
                      style={{ background: r.color }}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/campaigns/${r.id}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {r.client ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {r.productName ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatDate(r.startsAt)} – {formatDate(r.endsAt)}{" "}
                    <span className="text-xs">
                      ({dur} {pluralCs(dur, "den", "dny", "dní")})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {countByCampaign.get(r.id) ?? 0}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 text-xs">
                    {r.archivedAt ? formatRelative(r.archivedAt) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await unarchiveCampaign(r.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          title="Vrátit kampaň zpět do běžného přehledu"
                        >
                          Obnovit
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteCampaign(r.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 dark:border-red-900 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Definitivně smazat z databáze"
                        >
                          Smazat trvale
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  Žádné archivované kampaně.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
