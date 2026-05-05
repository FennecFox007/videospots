"use client";

// Inline modal for creating a spot from inside the campaign form. Replaces
// the older "+ Nový spot" link that opened /spots/new in a new tab and
// forced the user to reload the campaign form to see the freshly created
// spot in the dropdown.
//
// The modal is opened with a country pre-selected and locked (you only
// open it from the per-country picker for that country). Product fields
// are pre-filled from whatever the campaign form has typed in — which is
// the typical case (campaign and its spots are about the same product).
//
// On submit the server returns the created spot and the parent appends it
// to the local spot list for that country, then selects it. No
// router.refresh() needed — the dropdown reflects reality immediately
// without a server roundtrip beyond the create itself.

import { useEffect, useRef, useState, useTransition } from "react";
import { createSpotForPicker } from "@/app/spots/actions";
import { PRODUCT_KINDS, DEFAULT_PRODUCT_KIND } from "@/lib/products";
import { useT } from "@/lib/i18n/client";

export type CreatedSpot = {
  id: number;
  name: string | null;
  videoUrl: string;
  productName: string | null;
  countryId: number;
};

export type NewSpotModalProps = {
  /** Country the spot will be created for. Used to lock the country
   *  field in the modal — opening from a CZ row only creates a CZ spot. */
  country: {
    id: number;
    code: string;
    name: string;
    flag: string | null;
  };
  /** Pre-fill product name + kind. The campaign form usually has these
   *  filled by the time you click "+ Nový spot", and a spot is almost
   *  always for the same product as the campaign. */
  defaultProductName?: string;
  defaultProductKind?: string;
  onClose: () => void;
  onCreated: (spot: CreatedSpot) => void;
};

export function NewSpotModal({
  country,
  defaultProductName,
  defaultProductKind,
  onClose,
  onCreated,
}: NewSpotModalProps) {
  const t = useT();
  const [name, setName] = useState("");
  const [productName, setProductName] = useState(defaultProductName ?? "");
  const [productKind, setProductKind] = useState(
    defaultProductKind && defaultProductKind !== ""
      ? defaultProductKind
      : DEFAULT_PRODUCT_KIND
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first field on open — name is most likely what the user
    // wants to type first (URL is paste, kind/product are pre-filled).
    firstFieldRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUrl = videoUrl.trim();
    if (!trimmedUrl) {
      setError(t("spots.form.modal.error_url_required"));
      return;
    }
    try {
      // URL constructor throws on invalid input — catch and surface a
      // friendlier message than the zod error from the server would give.
      new URL(trimmedUrl);
    } catch {
      setError(t("spots.form.modal.error_url_invalid"));
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("productName", productName.trim());
    fd.set("productKind", productKind);
    fd.set("countryId", String(country.id));
    fd.set("videoUrl", trimmedUrl);

    startTransition(async () => {
      try {
        const spot = await createSpotForPicker(fd);
        onCreated(spot);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-spot-modal-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h2
              id="new-spot-modal-title"
              className="text-base font-semibold tracking-tight"
            >
              {t("spots.form.modal.title")}
            </h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span aria-hidden>{country.flag}</span>
              <span className="font-mono text-xs uppercase">
                {country.code}
              </span>
              <span>·</span>
              <span>{country.name}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 -m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm"
        >
          <Field
            label={t("spots.form.field.name")}
            hint={t("spots.form.field.name_hint")}
          >
            <input
              ref={firstFieldRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder={t("spots.form.field.name_placeholder")}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label={t("spots.form.field.product_name")}>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                maxLength={200}
                placeholder={t("spots.form.field.product_placeholder")}
                className={inputClass}
              />
            </Field>
            <Field label={t("spots.form.field.product_kind")}>
              <select
                value={productKind}
                onChange={(e) => setProductKind(e.target.value)}
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

          <Field label={t("spots.form.field.video_url")} required>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              maxLength={500}
              placeholder={t("spots.form.field.video_placeholder")}
              className={inputClass}
            />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Spacer so the footer doesn't bump fields. */}
          <div className="h-1" />
        </form>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              // Mirror the spot-drop modal's footer pattern: footer is
              // outside the <form>, so we have to find the form and call
              // requestSubmit() so native validation still runs.
              e.preventDefault();
              const form = (e.currentTarget as HTMLButtonElement)
                .closest("[role=dialog]")
                ?.querySelector("form");
              if (form instanceof HTMLFormElement) form.requestSubmit();
            }}
            disabled={isPending}
            className="text-sm px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
          >
            {isPending
              ? t("common.loading")
              : t("spots.form.modal.submit")}
          </button>
        </footer>
      </div>
    </div>
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
    <label className="block">
      <span className="text-xs text-zinc-500 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
