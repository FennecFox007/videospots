// Shared form body for /spots/new and /spots/[id]/edit. Mirrors the
// campaign form's pattern — Section / Field helpers — so both surfaces
// look like part of the same app.

import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";
import { db, countries } from "@/lib/db/client";
import { asc } from "drizzle-orm";
import { PRODUCT_KINDS } from "@/lib/products";

type Defaults = {
  name?: string | null;
  productName?: string | null;
  productKind?: string | null;
  countryId?: number;
  videoUrl?: string | null;
};

export async function SpotFormBody({
  defaults,
}: {
  defaults?: Defaults;
}) {
  const t = await getT();
  const countryRows = await db
    .select({
      id: countries.id,
      code: countries.code,
      name: countries.name,
      flag: countries.flagEmoji,
    })
    .from(countries)
    .orderBy(asc(countries.sortOrder));

  const inputClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <Section title={t("spots.form.section.basics")}>
        <Field label={t("spots.form.field.name")}>
          <input
            name="name"
            type="text"
            defaultValue={defaults?.name ?? ""}
            placeholder={t("spots.form.field.name_placeholder")}
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-zinc-500">
          {t("spots.form.field.name_hint")}
        </p>
      </Section>

      <Section title={t("spots.form.section.product")}>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t("spots.form.field.product_name")}>
            <input
              name="productName"
              type="text"
              defaultValue={defaults?.productName ?? ""}
              placeholder={t("spots.form.field.product_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("spots.form.field.product_kind")}>
            <select
              name="productKind"
              defaultValue={defaults?.productKind ?? "game"}
              className={inputClass}
            >
              {PRODUCT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-xs text-zinc-500">
          {t("spots.form.field.product_hint")}
        </p>
      </Section>

      <Section title={t("spots.form.section.where")}>
        <Field label={t("spots.form.field.country")} required>
          <div className="flex flex-wrap gap-2">
            {countryRows.map((c) => (
              <label
                key={c.id}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 has-[input:checked]:bg-blue-50 dark:has-[input:checked]:bg-blue-950/30 has-[input:checked]:ring-2 has-[input:checked]:ring-blue-400 has-[input:checked]:border-blue-400"
              >
                <input
                  type="radio"
                  name="countryId"
                  value={c.id}
                  required
                  defaultChecked={defaults?.countryId === c.id}
                  className="sr-only"
                />
                <span aria-hidden>{c.flag}</span>
                <span>{localizedCountryName(c.code, c.name, t.locale)}</span>
                <span className="font-mono text-xs uppercase text-zinc-500">
                  {c.code}
                </span>
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title={t("spots.form.section.video")}>
        <Field label={t("spots.form.field.video_url")} required>
          <input
            name="videoUrl"
            type="url"
            required
            defaultValue={defaults?.videoUrl ?? ""}
            placeholder={t("spots.form.field.video_placeholder")}
            className={inputClass}
          />
        </Field>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
