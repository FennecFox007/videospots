import Link from "next/link";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, auditLog, users, campaigns } from "@/lib/db/client";
import { formatRelative } from "@/lib/utils";
import { AuditFilterBar } from "@/components/audit-filter-bar";
import { AiDigest } from "@/components/ai-digest";

const PAGE_SIZE = 200;

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  created: {
    label: "vytvořil(a)",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  updated: {
    label: "upravil(a)",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  },
  deleted: {
    label: "smazal(a)",
    className: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  },
  approved: {
    label: "schválil(a)",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  cancelled: {
    label: "zrušil(a)",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
};

type SearchParams = {
  user?: string;
  action?: string;
  entity?: string;
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

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to);
  // Inclusive end-of-day on toDate
  const toDateInclusive = toDate
    ? new Date(toDate.getTime() + 86_400_000 - 1)
    : null;

  const conds = [];
  if (params.user) conds.push(eq(auditLog.userId, params.user));
  if (params.action) conds.push(eq(auditLog.action, params.action));
  if (params.entity) conds.push(eq(auditLog.entity, params.entity));
  if (fromDate) conds.push(gte(auditLog.createdAt, fromDate));
  if (toDateInclusive) conds.push(lte(auditLog.createdAt, toDateInclusive));

  const [rows, userListRows] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
        userEmail: users.email,
        userName: users.name,
        campaignName: campaigns.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .leftJoin(campaigns, eq(auditLog.entityId, campaigns.id))
      .where(conds.length > 0 ? and(...conds) : sql`true`)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE_SIZE),
    db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .orderBy(asc(users.email)),
  ]);

  const userOptions = userListRows.map((u) => ({
    id: u.id,
    label: u.name ?? u.email,
  }));

  const hasAnyFilter =
    !!params.user ||
    !!params.action ||
    !!params.entity ||
    !!params.from ||
    !!params.to;

  return (
    <div className="space-y-4">
      <AiDigest />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {hasAnyFilter
          ? `${rows.length} ${pluralRecords(rows.length)} odpovídajících filtrům.`
          : `Posledních ${rows.length} ${pluralRecords(rows.length)} z auditního logu.`}{" "}
        Kdo / kdy / co.
      </p>

      <AuditFilterBar users={userOptions} />

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium w-44">Kdy</th>
              <th className="px-4 py-2 font-medium">Kdo</th>
              <th className="px-4 py-2 font-medium">Akce</th>
              <th className="px-4 py-2 font-medium">Co</th>
              <th className="px-4 py-2 font-medium">Detail změny</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = ACTION_LABELS[r.action] ?? {
                label: r.action,
                className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800",
              };
              return (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatRelative(r.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                    {r.userName ?? r.userEmail ?? (
                      <span className="text-zinc-400">smazaný uživatel</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "inline-block rounded-md px-2 py-0.5 text-xs font-medium " +
                        meta.className
                      }
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.entity === "campaign" && r.entityId ? (
                      r.campaignName ? (
                        <Link
                          href={`/campaigns/${r.entityId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.campaignName}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">
                          kampaň #{r.entityId} (smazaná)
                        </span>
                      )
                    ) : (
                      <span className="text-zinc-500">
                        {r.entity}
                        {r.entityId ? ` #${r.entityId}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 font-mono">
                    {formatChanges(r.changes)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Žádné záznamy odpovídající filtrům.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pluralRecords(n: number) {
  if (n === 1) return "záznam";
  if (n >= 2 && n <= 4) return "záznamy";
  return "záznamů";
}

function formatChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "—";
  const entries = Object.entries(changes as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${k}: ${truncate(String(v), 40)}`)
    .join(", ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
