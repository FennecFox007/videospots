// Products admin — CRUD over the product catalog. Lets the team add titles
// (with release dates and covers) before any campaign exists, so /releases
// has something to show and /campaigns/new can find them by name.

import { asc, eq, sql, desc } from "drizzle-orm";
import Link from "next/link";
import { db, products, campaigns } from "@/lib/db/client";
import {
  PRODUCT_KINDS,
  DEFAULT_PRODUCT_KIND,
  kindEmoji,
  kindLabel,
} from "@/lib/products";
import { formatDate } from "@/lib/utils";
import { createProduct, deleteProduct } from "./actions";

type SearchParams = {
  q?: string;
  kind?: string;
};

export default async function ProductsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const kindFilter = params.kind ?? "";

  const all = await db
    .select({
      id: products.id,
      name: products.name,
      kind: products.kind,
      releaseDate: products.releaseDate,
      coverUrl: products.coverUrl,
      summary: products.summary,
    })
    .from(products)
    .orderBy(desc(products.releaseDate), asc(products.name));

  // Campaign count per product — small extra query, lets us show usage.
  const counts = await db
    .select({
      productId: campaigns.productId,
      count: sql<number>`count(*)::int`,
    })
    .from(campaigns)
    .where(sql`${campaigns.productId} IS NOT NULL`)
    .groupBy(campaigns.productId);
  const countByProduct = new Map(
    counts
      .filter((r): r is { productId: number; count: number } => r.productId !== null)
      .map((r) => [r.productId, r.count])
  );

  const filtered = all.filter((p) => {
    if (kindFilter && p.kind !== kindFilter) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!p.name.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">Přidat produkt</h2>
        <form action={createProduct} className="grid gap-3 md:grid-cols-2">
          <Field
            label="Název"
            name="name"
            required
            placeholder="např. Saros, PS5 Slim, DualSense Edge…"
          />
          <SelectField
            label="Druh"
            name="kind"
            defaultValue={DEFAULT_PRODUCT_KIND}
            options={PRODUCT_KINDS.map((k) => ({
              value: k.value,
              label: `${k.emoji} ${k.label}`,
            }))}
          />
          <Field label="Datum vydání" name="releaseDate" type="date" />
          <Field
            label="Obrázek (URL)"
            name="coverUrl"
            type="url"
            placeholder="https://…"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
              Stručný popis
            </label>
            <textarea
              name="summary"
              rows={2}
              placeholder="krátká věta o produktu (volitelné)"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
            >
              Přidat produkt
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3 items-end">
          <form className="flex flex-wrap gap-3 items-end flex-1" method="get">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
                Hledat
              </label>
              <input
                name="q"
                defaultValue={q}
                placeholder="podle názvu…"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
                Druh
              </label>
              <select
                name="kind"
                defaultValue={kindFilter}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— všechny —</option>
                {PRODUCT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.emoji} {k.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Filtrovat
            </button>
            {(q || kindFilter) && (
              <Link
                href="/admin/products"
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline-offset-2 hover:underline"
              >
                Vyčistit
              </Link>
            )}
          </form>
          <span className="text-xs text-zinc-500">
            {filtered.length} / {all.length} produktů
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium w-16">Cover</th>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">Druh</th>
              <th className="px-4 py-2 font-medium">Vydání</th>
              <th className="px-4 py-2 font-medium text-right">Spoty</th>
              <th className="px-4 py-2 font-medium w-32">Akce</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cnt = countByProduct.get(p.id) ?? 0;
              return (
                <tr
                  key={p.id}
                  className="border-t border-zinc-100 dark:border-zinc-800 align-top"
                >
                  <td className="px-4 py-2">
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.coverUrl}
                        alt=""
                        className="w-10 h-14 object-cover rounded ring-1 ring-zinc-200 dark:ring-zinc-800"
                      />
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.summary && (
                      <div className="text-xs text-zinc-500 line-clamp-2 max-w-md mt-0.5">
                        {p.summary}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs">
                      <span aria-hidden>{kindEmoji(p.kind)}</span>
                      {kindLabel(p.kind)}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {p.releaseDate ? formatDate(p.releaseDate) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {cnt > 0 ? (
                      <Link
                        href={`/campaigns?q=${encodeURIComponent(p.name)}`}
                        className="hover:underline"
                      >
                        {cnt}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-sm text-zinc-700 dark:text-zinc-300 hover:underline mr-3"
                    >
                      Upravit
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteProduct(p.id);
                      }}
                      className="inline"
                    >
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:text-red-700"
                        title={
                          cnt > 0
                            ? `Smaže produkt; ${cnt} kampaním zůstane bez vazby na produkt.`
                            : "Smazat produkt"
                        }
                      >
                        Smazat
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  {all.length === 0
                    ? "Žádné produkty. Přidej výše nebo se vytvoří automaticky při plánování spotu."
                    : "Žádné produkty neodpovídají filtru."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={type ?? "text"}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Edit page = separate route /admin/products/[id]; no inline editor here to
// keep this list scannable.
export const dynamic = "force-dynamic";
