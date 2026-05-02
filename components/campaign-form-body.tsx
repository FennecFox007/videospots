// Shared form body used by both `/campaigns/new` and `/campaigns/[id]/edit`.
// Doesn't render the surrounding <form> tag — callers wrap it with their own
// `action={...}` so we can route to either createCampaign or updateCampaign.

import { toDateInputValue } from "@/lib/utils";
import { CAMPAIGN_COLORS, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import { ChannelsPicker } from "./channels-picker";

export type CampaignFormDefaults = {
  name?: string;
  client?: string | null;
  videoUrl?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  notes?: string | null;
  color?: string | null;
  status?: string | null;
  tags?: string[] | null;
  game?: {
    name?: string | null;
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

export function CampaignFormBody({
  defaults,
  groups,
  submitLabel,
  cancelHref,
  showRecurring,
}: Props) {
  const today = new Date();
  const twoWeeks = new Date();
  twoWeeks.setDate(today.getDate() + 14);

  const startsAt = defaults?.startsAt ?? today;
  const endsAt = defaults?.endsAt ?? twoWeeks;
  const selected = defaults?.channelIds ?? new Set<number>();
  const currentColor = defaults?.color ?? DEFAULT_CAMPAIGN_COLOR;
  const currentTags = defaults?.tags ?? [];

  return (
    <>
      <Section title="Základní údaje">
        <Field label="Název kampaně" required>
          <input
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="např. Saros — launch trailer"
            className={inputClass}
          />
        </Field>

        <Field label="Klient">
          <input
            name="client"
            defaultValue={defaults?.client ?? "Sony Interactive Entertainment"}
            className={inputClass}
          />
        </Field>

        <Field
          label="Štítky"
          hint='Odděl čárkou: "priorita, jaro, launch"'
        >
          <input
            name="tags"
            defaultValue={currentTags.join(", ")}
            placeholder="priorita, sezóna, …"
            className={inputClass}
          />
        </Field>

        <Field label="Barva v timeline">
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
        title="Hra"
        hint="Volitelné. Pokud kampaň propaguje konkrétní titul, vyplň co máš — ostatní pole nech prázdná."
      >
        <Field label="Název hry">
          <input
            name="gameName"
            defaultValue={defaults?.game?.name ?? ""}
            placeholder="např. Saros"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum vydání">
            <input
              name="gameReleaseDate"
              type="date"
              defaultValue={
                defaults?.game?.releaseDate
                  ? toDateInputValue(defaults.game.releaseDate)
                  : ""
              }
              className={inputClass}
            />
          </Field>
          <Field label="Cover URL" hint="Odkaz na obrázek (jpg, png, webp)">
            <input
              name="gameCoverUrl"
              type="url"
              defaultValue={defaults?.game?.coverUrl ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Stručný popis">
          <textarea
            name="gameSummary"
            rows={2}
            defaultValue={defaults?.game?.summary ?? ""}
            placeholder="krátká věta o hře"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </Section>

      <Section title="Video">
        <Field label="URL videa" hint="YouTube, Vimeo nebo přímý odkaz na mp4">
          <input
            name="videoUrl"
            type="url"
            defaultValue={defaults?.videoUrl ?? ""}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Termín">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Začátek" required>
            <input
              name="startsAt"
              type="date"
              required
              defaultValue={toDateInputValue(startsAt)}
              className={inputClass}
            />
          </Field>
          <Field label="Konec" required>
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
        title="Kanály"
        hint="Vyber kombinace stát × řetězec, kde má kampaň běžet. Hromadný výběr přes tlačítka, jednotlivé pak jen klikni."
      >
        <ChannelsPicker
          groups={groups}
          defaultSelected={Array.from(selected)}
        />
      </Section>

      <Section title="Poznámky">
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          placeholder="cokoli užitečného (interní info, briefing…)"
          className={`${inputClass} resize-y`}
        />
      </Section>

      {showRecurring && (
        <Section
          title="Opakovat (volitelné)"
          hint="Vytvoří víc kampaní najednou s posunutými datumy. Vhodné pro pravidelné spoty."
        >
          <RecurringFields />
        </Section>
      )}

      <div className="flex items-center justify-end gap-3">
        <a
          href={cancelHref}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Zrušit
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
function RecurringFields() {
  return (
    <div>
      <label className="inline-flex items-center gap-2 text-sm cursor-pointer mb-2">
        <input type="checkbox" name="recurring" value="1" className="rounded" />
        <span>Vytvořit sérii kampaní</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
            Frekvence
          </label>
          <select
            name="recurringStep"
            defaultValue="7"
            className={inputClass}
          >
            <option value="1">každý den</option>
            <option value="7">každý týden</option>
            <option value="14">každé 2 týdny</option>
            <option value="28">každé 4 týdny</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
            Počet kampaní
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
      <p className="text-xs text-zinc-500 mt-2">
        Každá další kampaň bude pojmenovaná „Název (n/N)". Výběr kanálů a hra
        se zachovají u všech.
      </p>
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
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
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
