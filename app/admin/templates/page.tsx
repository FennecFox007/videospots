import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  db,
  campaignTemplates,
  users,
} from "@/lib/db/client";
import { formatRelative, daysBetween, pluralCs } from "@/lib/utils";
import { deleteTemplate } from "./actions";
import type { TemplatePayload } from "./actions";

export default async function TemplatesPage() {
  const rows = await db
    .select({
      id: campaignTemplates.id,
      name: campaignTemplates.name,
      payload: campaignTemplates.payload,
      createdAt: campaignTemplates.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(campaignTemplates)
    .leftJoin(users, eq(campaignTemplates.createdById, users.id))
    .orderBy(desc(campaignTemplates.createdAt));

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Šablony se zakládají na detailu kampaně přes „Uložit jako šablonu".
        Při tvorbě nové kampaně si pak můžeš šablonu vybrat a formulář se
        předvyplní.
      </p>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">Klient</th>
              <th className="px-4 py-2 font-medium">Délka</th>
              <th className="px-4 py-2 font-medium">Kanály</th>
              <th className="px-4 py-2 font-medium">Vytvořil(a)</th>
              <th className="px-4 py-2 font-medium w-32">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const p = t.payload as TemplatePayload;
              return (
                <tr
                  key={t.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
                        style={{ background: p.color }}
                      />
                      <span className="font-medium">{t.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {p.client ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {p.durationDays}{" "}
                    {pluralCs(p.durationDays, "den", "dny", "dní")}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {p.channelIds.length}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    <span className="block">
                      {t.authorName ?? t.authorEmail ?? "—"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatRelative(t.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/campaigns/new?template=${t.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Použít
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await deleteTemplate(t.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Smazat
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Žádné šablony. Otevři detail libovolné kampaně a klikni
                  „Uložit jako šablonu".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
