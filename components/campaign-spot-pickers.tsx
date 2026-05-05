"use client";

// Per-country spot picker section of the campaign form. Used by both
// /campaigns/new and /campaigns/[id]/edit via <CampaignFormBody />.
// Replaces the previous server-rendered inline JSX so the "+ Nový spot"
// flow can be a client-only inline modal — no new tab, no router.refresh,
// the freshly created spot just lands in the dropdown selected.
//
// State held locally (per mount):
//   - addedByCountry  newly created spots, keyed by countryId. Prepended
//                     to the server-supplied options list when rendering.
//   - selected        per-country selected spot id (string for <select>
//                     value compatibility). Pre-filled from `defaults`.
//
// The <select>s are CONTROLLED so we can programmatically pick a freshly
// created spot. Their `name="spotId_<countryId>"` matches what the
// campaign form's server action reads via extractSpotsByCountry().

import { useState } from "react";
import type { SpotOption, CountryGroup } from "@/components/campaign-form-body";
import { NewSpotModal, type CreatedSpot } from "@/components/new-spot-modal";
import { useT } from "@/lib/i18n/client";
import { localizedCountryName } from "@/lib/i18n/country";
import { spotApprovalState } from "@/lib/spot-approval";

type Props = {
  groups: CountryGroup[];
  initialSpotsByCountry: Record<number, SpotOption[]>;
  /** Pre-filled selection per country (countryId → spotId). */
  initialSelected: Record<number, number>;
};

export function CampaignSpotPickers({
  groups,
  initialSpotsByCountry,
  initialSelected,
}: Props) {
  const t = useT();
  const [addedByCountry, setAddedByCountry] = useState<
    Record<number, SpotOption[]>
  >({});
  const [selected, setSelected] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(initialSelected)) {
      out[Number(k)] = String(v);
    }
    return out;
  });
  // When the modal opens we grab product fields from the surrounding form
  // by `name=` selector — the campaign form has `productName` and
  // `productKind` inputs on it, and reading them at open time means the
  // user's most recent typing is what we pre-fill the modal with.
  const [openFor, setOpenFor] = useState<{
    country: CountryGroup;
    productName: string;
    productKind: string;
  } | null>(null);

  function openModalFor(group: CountryGroup) {
    const productName =
      (document.querySelector<HTMLInputElement>("input[name='productName']")
        ?.value ?? "").trim();
    const productKind =
      document.querySelector<HTMLSelectElement>("select[name='productKind']")
        ?.value ?? "";
    setOpenFor({ country: group, productName, productKind });
  }

  function handleCreated(spot: CreatedSpot) {
    // Append into the country's added list, then auto-select. Uses ids as
    // strings to match the <select> value type. Fresh spots are
    // pending — both approval timestamps null.
    setAddedByCountry((prev) => ({
      ...prev,
      [spot.countryId]: [
        {
          id: spot.id,
          name: spot.name,
          videoUrl: spot.videoUrl,
          productName: spot.productName,
          clientApprovedAt: spot.clientApprovedAt,
          rejectedAt: spot.rejectedAt,
        },
        ...(prev[spot.countryId] ?? []),
      ],
    }));
    setSelected((prev) => ({ ...prev, [spot.countryId]: String(spot.id) }));
    setOpenFor(null);
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const baseOptions = initialSpotsByCountry[g.id] ?? [];
        const addedOptions = addedByCountry[g.id] ?? [];
        // Newly added spots prepend so the user sees their fresh creation
        // at the top of the list — matches the server-side ordering
        // (spots ORDER BY createdAt DESC).
        const options = [...addedOptions, ...baseOptions];
        const value = selected[g.id] ?? "";
        // Look up the picked spot to surface an approval warning if it's
        // pending / rejected. Editor can still submit (info-only nudge —
        // schválení can land after the campaign is planned), so we don't
        // disable the form, just flag it.
        const pickedSpot = value
          ? options.find((s) => String(s.id) === value)
          : null;
        const pickedState = pickedSpot
          ? spotApprovalState(pickedSpot)
          : null;
        return (
          <div key={g.id} className="space-y-1">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
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
              <select
                name={`spotId_${g.id}`}
                value={value}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [g.id]: e.target.value }))
                }
                className={inputClass}
              >
                <option value="">{t("form.video.no_spot")}</option>
                {options.map((s) => {
                  const label = s.name
                    ? s.name
                    : s.productName
                      ? `${s.productName} · ${g.code}`
                      : `Spot · ${g.code}`;
                  // Annotate the option label with state so the picker
                  // shows status before the user even commits.
                  const state = spotApprovalState(s);
                  const stateMark =
                    state === "approved"
                      ? " ✓"
                      : state === "rejected"
                        ? " ✕"
                        : ""; // pending = no mark, default state
                  return (
                    <option key={s.id} value={String(s.id)}>
                      {label}
                      {stateMark}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => openModalFor(g)}
                className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                title={t("form.video.new_spot_tooltip")}
              >
                {t("form.video.new_spot")}
              </button>
            </div>
            {pickedState === "pending" && (
              <p className="text-xs text-amber-700 dark:text-amber-400 ml-[5.25rem]">
                {t("spot_picker.warning.pending")}
              </p>
            )}
            {pickedState === "rejected" && (
              <p className="text-xs text-red-700 dark:text-red-400 ml-[5.25rem]">
                {t("spot_picker.warning.rejected")}
              </p>
            )}
          </div>
        );
      })}

      {openFor && (
        <NewSpotModal
          country={{
            id: openFor.country.id,
            code: openFor.country.code,
            name: openFor.country.name,
            flag: openFor.country.flag,
          }}
          defaultProductName={openFor.productName}
          defaultProductKind={openFor.productKind}
          onClose={() => setOpenFor(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
