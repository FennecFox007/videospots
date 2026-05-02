// Edit a single product. Same fields as the inline create form on the index,
// pre-filled. Saves via updateProduct server action.

import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, asc } from "drizzle-orm";
import { db, products, campaigns } from "@/lib/db/client";
import {
  PRODUCT_KINDS,
  DEFAULT_PRODUCT_KIND,
  kindEmoji,
  kindLabel,
} from "@/lib/products";
import { formatDate, toDateInputValue, computedRunState } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { updateProduct, deleteProduct } from "../actions";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) notFound();

  const [p] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!p) notFound();

  const linkedCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      color: campaigns.color,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
    })
    .from(campaigns)
    .where(eq(campaigns.productId, productId))
    .orderBy(asc(campaigns.startsAt));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/admin/products"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Produkty
          </Link>
          <h2 className="text-xl font-semibold tracking-tight mt-1">
            {p.name}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {kindEmoji(p.kind)} {kindLabel(p.kind)}
            {p.releaseDate && ` · vydáno ${formatDate(p.releaseDate)}`}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="font-medium mb-3">Upravit</h3>
        <form
          action={updateProduct.bind(null, productId)}
          className="grid gap-3 md:grid-cols-2"
        >
          <Field label="Název" name="name" required defaultValue={p.name} />
          <SelectField
            label="Druh"
            name="kind"
            defaultValue={p.kind ?? DEFAULT_PRODUCT_KIND}
            options={PRODUCT_KINDS.map((k) => ({
              value: k.value,
              label: `${k.emoji} ${k.label}`,
            }))}
          />
          <Field
            label="Datum vydání"
            name="releaseDate"
            type="date"
            defaultValue={
              p.releaseDate ? toDateInputValue(p.releaseDate) : ""
            }
          />
          <Field
            label="Obrázek (URL)"
            name="coverUrl"
            type="url"
            defaultValue={p.coverUrl ?? ""}
            placeholder="https://…"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
              Stručný popis
            </label>
            <textarea
              name="summary"
              rows={3}
              defaultValue={p.summary ?? ""}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <form
              action={async () => {
                "use server";
                await deleteProduct(productId);
              }}
            >
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 dark:border-red-900/50 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                title={
                  linkedCampaigns.length > 0
                    ? `${linkedCampaigns.length} kampaním zůstane bez vazby na produkt`
                    : "Smazat produkt"
                }
              >
                Smazat produkt
              </button>
            </form>
            <button
              type="submit"
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
            >
              Uložit změny
            </button>
          </div>
        </form>
      </section>

      {p.coverUrl && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h3 className="font-medium mb-3">Cover</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.coverUrl}
            alt={p.name}
            className="max-w-xs rounded ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="font-medium mb-3">
          Kampaně k tomuto produktu ({linkedCampaigns.length})
        </h3>
        {linkedCampaigns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Zatím žádná kampaň.{" "}
            <Link
              href={`/campaigns/new?productName=${encodeURIComponent(p.name)}`}
              className="underline"
            >
              Založit první
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {linkedCampaigns.map((c) => {
              const runState = computedRunState(c);
              return (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="flex items-center gap-2 py-1.5 text-sm hover:underline"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    <span className="font-medium flex-1 truncate">
                      {c.name}
                    </span>
                    <StatusBadge status={c.status} runState={runState} />
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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
