// Shared form body used by both `/campaigns/new` and `/campaigns/[id]/edit`.
// Doesn't render the surrounding <form> tag — callers wrap it with their own
// `action={...}` so we can route to either createCampaign or updateCampaign.

import { toDateInputValue } from "@/lib/utils";
import { CAMPAIGN_COLORS, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import { PRODUCT_KINDS, DEFAULT_PRODUCT_KIND } from "@/lib/products";
import { COMMUNICATION_TYPES } from "@/lib/communication";
import { ChannelsPicker } from "./channels-picker";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";

export type CampaignFormDefaults = {
  name?: string;
  client?: string | null;
  /** Per-country video URLs, keyed by country.id. Empty entry = no video for
   *  that country. Each country runs its own language cut of the spot, so
   *  there's no single "campaign video URL" — see lib/db/schema.ts. */
  videosByCountry?: Record<number, string>;
  startsAt?: Date;
  endsAt?: Date;
  notes?: string | null;
  color?: string | null;
  status?: string | null;
  communicationType?: string | null;
  tags?: string[] | null;
  product?: {
    name?: string | null;
    kind?: string | null;
    releaseDate?: Date | null;
    coverUrl?: string | null;
    summary?: string | null;
  } | null;
  channelIds?: Set<number>;
};

export type CountryGroup = {
  id: number;
  code: string;
  name: string;
  flag: string | null;
  channels: { id: number; chainName: string }[];
};

type Props = {
  defaults?: CampaignFormDefaults;
  groups: CountryGroup[];
  submitLabel: string;
  cancelHref: string;
  /** Show the "create as recurring series" section. Only meaningful on /new. */
  showRecurring?: boolean;
};

export async function CampaignFormBody({
  defaults,
  groups,
  submitLabel,
  cancelHref,
  showRecurring,
}: Props) {
  const t = await getT();
  const today = new Date();
  const twoWeeks = new Date();
  twoWeeks.setDate(today.getDate() + 14);

  const startsAt = defaults?.startsAt ?? today;
  const endsAt = defaults?.endsAt ?? twoWeeks;
  const selected = defaults?.channelIds ?? new Set<number>();
  const currentColor = defaults?.color ?? DEFAULT_CAMPAIGN_COLOR;
  const currentCommunicationType = defaults?.communicationType ?? "";
  const currentTags = defaults?.tags ?? [];

  return (
    <>
      <Section title={t("form.section.basic")}>
        <Field label={t("form.field.name")} required>
          <input
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder={t("form.field.name_placeholder")}
            className={inputClass}
          />
        </Field>

        <Field label={t("form.field.client")}>
          <input
            name="client"
            defaultValue={defaults?.client ?? "Sony Interactive Entertainment"}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("form.field.comm_type")}
            hint={t("form.field.comm_type_hint")}
          >
            <select
              name="communicationType"
              defaultValue={currentCommunicationType}
              className={inputClass}
            >
              <option value="">— —</option>
              {COMMUNICATION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label} — {ct.description}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("form.field.tags")}
            hint={t("form.field.tags_hint")}
          >
            <input
              name="tags"
              defaultValue={currentTags.join(", ")}
              placeholder={t("form.field.tags_placeholder")}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("form.field.color")}>
          <div className="flex flex-wrap gap-3">
            {CAMPAIGN_COLORS.map((c) => (
              <label
                key={c.value}
                title={c.name}
                className="cursor-pointer relative inline-block"
              >
                <input
                  type="radio"
                  name="color"
                  value={c.value}
                  defaultChecked={currentColor === c.value}
                  className="peer sr-only"
                />
                <span
                  className="block w-9 h-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 transition-all peer-checked:ring-zinc-900 dark:peer-checked:ring-white peer-checked:scale-110"
                  style={{ background: c.value }}
                />
                <span
                  className="absolute inset-0 hidden peer-checked:flex items-center justify-center text-white text-base font-bold pointer-events-none drop-shadow-md"
                  aria-hidden
                >
                  ✓
                </span>
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section
        title={t("form.section.product")}
        hint={t("form.section.product_hint")}
      >
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t("form.field.product_name")}>
            <input
              name="productName"
              defaultValue={defaults?.product?.name ?? ""}
              placeholder={t("form.field.product_name_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("form.field.product_kind")}>
            <select
              name="productKind"
              defaultValue={defaults?.product?.kind ?? DEFAULT_PRODUCT_KIND}
              className={inputClass}
            >
              {PRODUCT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.emoji} {k.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("form.field.product_release_date")}
            hint={t("form.field.product_release_date_hint")}
          >
            <input
              name="productReleaseDate"
              type="date"
              defaultValue={
                defaults?.product?.releaseDate
                  ? toDateInputValue(defaults.product.releaseDate)
                  : ""
              }
              className={inputClass}
            />
          </Field>
          <Field
            label={t("form.field.product_cover_url")}
            hint={t("form.field.product_cover_url_hint")}
          >
            <input
              name="productCoverUrl"
              type="url"
              defaultValue={defaults?.product?.coverUrl ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("form.field.product_summary")}>
          <textarea
            name="productSummary"
            rows={2}
            defaultValue={defaults?.product?.summary ?? ""}
            placeholder={t("form.field.product_summary_placeholder")}
            className={`${inputClass} resize-y`}
          />
        </Field>
      </Section>

      <Section
        title={t("form.section.video")}
        hint={t("form.section.video_hint")}
      >
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 w-20 sm:w-24 shrink-0">
                <span className="text-base leading-none" aria-hidden>
                  {g.flag}
                </span>
                <span
                  className="font-mono text-xs uppercase"
                  title={localizedCountryName(g.code, g.name, t.locale)}
                >
                  {g.code}
                </span>
              </span>
              <input
                name={`videoUrl_${g.id}`}
                type="url"
                defaultValue={defaults?.videosByCountry?.[g.id] ?? ""}
                placeholder={t("form.video.placeholder")}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("form.section.term")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("form.field.starts_at")} required>
            <input
              name="startsAt"
              type="date"
              required
              defaultValue={toDateInputValue(startsAt)}
              className={inputClass}
            />
          </Field>
          <Field label={t("form.field.ends_at")} required>
            <input
              name="endsAt"
              type="date"
              required
              defaultValue={toDateInputValue(endsAt)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section
        title={t("form.section.channels")}
        hint={t("form.section.channels_hint")}
      >
        <ChannelsPicker
          groups={groups}
          defaultSelected={Array.from(selected)}
        />
      </Section>

      <Section title={t("form.section.notes")}>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          placeholder={t("form.field.notes_placeholder")}
          className={`${inputClass} resize-y`}
        />
      </Section>

      {showRecurring && (
        <Section
          title={t("form.section.recurring")}
          hint={t("form.section.recurring_hint")}
        >
          <RecurringFields
            labels={{
              toggle: t("form.recurring.toggle"),
              frequency: t("form.recurring.frequency"),
              freqDaily: t("form.recurring.freq_daily"),
              freqWeekly: t("form.recurring.freq_weekly"),
              freqBiweekly: t("form.recurring.freq_biweekly"),
              freqMonthly: t("form.recurring.freq_monthly"),
              count: t("form.recurring.count"),
              note: t("form.recurring.note"),
            }}
          />
        </Section>
      )}

      <div className="flex items-center justify-end gap-3">
        <a
          href={cancelHref}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          {t("form.cancel")}
        </a>
        <button
          type="submit"
          className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}

/**
 * Inline UI for the "create as series" option. The recurring checkbox and its
 * follow-up fields are submitted with the campaign form; the server action
 * splits them into N campaigns post-validation.
 */
function RecurringFields({
  labels,
}: {
  labels: {
    toggle: string;
    frequency: string;
    freqDaily: string;
    freqWeekly: string;
    freqBiweekly: string;
    freqMonthly: string;
    count: string;
    note: string;
  };
}) {
  return (
    <div>
      <label className="inline-flex items-center gap-2 text-sm cursor-pointer mb-2">
        <input type="checkbox" name="recurring" value="1" className="rounded" />
        <span>{labels.toggle}</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
            {labels.frequency}
          </label>
          <select
            name="recurringStep"
            defaultValue="7"
            className={inputClass}
          >
            <option value="1">{labels.freqDaily}</option>
            <option value="7">{labels.freqWeekly}</option>
            <option value="14">{labels.freqBiweekly}</option>
            <option value="28">{labels.freqMonthly}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
            {labels.count}
          </label>
          <input
            type="number"
            name="recurringCount"
            min={1}
            max={24}
            defaultValue={4}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-2">{labels.note}</p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
