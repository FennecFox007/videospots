// Shared form field primitive — replaces the four near-duplicate Field
// helpers that lived in campaign-form-body, spot-form-body, new-spot-modal
// and spot-drop-modal. They diverged on label size, required-asterisk
// color, wrapper element, and hint support; this collapses them into one
// canonical with a `size` knob.
//
//   <Field label="Název spotu" required>
//     <input ... />
//   </Field>
//
//   <Field label="Note" hint="Optional internal note" size="sm">
//     <textarea ... />
//   </Field>
//
// The `<label>` wrapper means clicking the label text focuses the first
// input descendant — accessible by default. Each Field should contain a
// single focusable control; for multi-control rows wrap the row in a grid
// and put one Field per cell (see /campaigns/new "termín" section).

import type { ReactNode } from "react";

export type FieldSize = "sm" | "md";

type Props = {
  label: string;
  /** Optional hint shown below the input in muted small text. */
  hint?: string;
  required?: boolean;
  /** "md" (default) — text-sm font-medium label, for the main page forms.
   *  "sm" — text-xs muted label, for compact modals where vertical space
   *  is tight and the surrounding layout already conveys context. */
  size?: FieldSize;
  children: ReactNode;
};

export function Field({
  label,
  hint,
  required,
  size = "md",
  children,
}: Props) {
  return (
    <label className="block">
      <span
        className={
          "block mb-1 " +
          (size === "sm"
            ? "text-xs text-zinc-500"
            : "text-sm font-medium")
        }
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-xs text-zinc-500 mt-1">{hint}</p>
      )}
    </label>
  );
}
