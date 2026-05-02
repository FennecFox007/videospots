"use client";

// Replacement for window.alert / window.confirm / window.prompt and a small
// toast system, exposed via a single context. Mounted once in the root layout
// (DialogProvider wraps the body).
//
// Why imperative API (await confirm(...)): replacing native dialogs with a
// declarative state-based dialog at every call site is invasive. The hook
// returns Promise-based functions that match the mental model of the old
// natives, so existing code paths convert to:
//
//   const { confirm, toast } = useDialog();
//   if (!(await confirm({ title: "Archivovat?" }))) return;
//   await archive(...);
//   toast.success("Archivováno");

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive = red confirm button. Use for archive/delete/cancel. */
  destructive?: boolean;
};

export type PromptOptions = ConfirmOptions & {
  defaultValue?: string;
  placeholder?: string;
  /** Optional inline validator; return string = error message, null = ok. */
  validate?: (value: string) => string | null;
};

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type DialogContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
};

const DialogCtx = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogCtx);
  if (!ctx) {
    throw new Error("useDialog must be used inside <DialogProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Internal state shapes
// ---------------------------------------------------------------------------

type ActiveDialog =
  | {
      kind: "confirm";
      opts: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: "prompt";
      opts: PromptOptions;
      resolve: (value: string | null) => void;
    };

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const TOAST_TIMEOUT_MS = 4000;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      window.setTimeout(() => dismissToast(id), TOAST_TIMEOUT_MS);
    },
    [dismissToast]
  );

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setDialog({ kind: "confirm", opts, resolve });
      }),
    []
  );

  const promptFn = useCallback(
    (opts: PromptOptions): Promise<string | null> =>
      new Promise<string | null>((resolve) => {
        setDialog({ kind: "prompt", opts, resolve });
      }),
    []
  );

  const value = useMemo<DialogContextValue>(
    () => ({
      confirm,
      prompt: promptFn,
      toast: {
        success: (m) => pushToast("success", m),
        error: (m) => pushToast("error", m),
        info: (m) => pushToast("info", m),
      },
    }),
    [confirm, promptFn, pushToast]
  );

  function closeDialog(result: boolean | string | null) {
    if (!dialog) return;
    if (dialog.kind === "confirm") {
      dialog.resolve(typeof result === "boolean" ? result : false);
    } else {
      dialog.resolve(typeof result === "string" ? result : null);
    }
    setDialog(null);
  }

  return (
    <DialogCtx.Provider value={value}>
      {children}
      {dialog && <DialogHost dialog={dialog} onClose={closeDialog} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </DialogCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Dialog UI (confirm + prompt share the same shell)
// ---------------------------------------------------------------------------

function DialogHost({
  dialog,
  onClose,
}: {
  dialog: ActiveDialog;
  onClose: (result: boolean | string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const [promptValue, setPromptValue] = useState(
    dialog.kind === "prompt" ? dialog.opts.defaultValue ?? "" : ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const opts = dialog.opts;
  const isPrompt = dialog.kind === "prompt";
  const promptOpts = isPrompt ? (opts as PromptOptions) : null;
  const confirmLabel = opts.confirmLabel ?? (isPrompt ? "Uložit" : "OK");
  const cancelLabel = opts.cancelLabel ?? "Zrušit";

  // Auto-focus the right element on mount (input for prompt, confirm button
  // for confirm so Enter/Space confirms immediately).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (isPrompt) inputRef.current?.select();
      else confirmBtnRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isPrompt]);

  // Lock body scroll while dialog is open. (The outer modal already darkens
  // the page; without scroll lock the underlying page can drift.)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC = cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose(isPrompt ? null : false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPrompt, onClose]);

  function handleConfirm() {
    if (isPrompt) {
      const trimmed = promptValue.trim();
      if (promptOpts?.validate) {
        const err = promptOpts.validate(trimmed);
        if (err !== null) {
          setValidationError(err);
          return;
        }
      }
      onClose(trimmed);
    } else {
      onClose(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(isPrompt ? null : false);
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-host-title"
        className="w-full max-w-sm rounded-lg bg-white dark:bg-zinc-900 shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-800 outline-none"
      >
        <div className="px-5 pt-5 pb-4">
          <h2
            id="dialog-host-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {opts.title}
          </h2>
          {opts.message && (
            <div className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-snug">
              {opts.message}
            </div>
          )}

          {isPrompt && (
            <div className="mt-3">
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                placeholder={promptOpts?.placeholder}
                onChange={(e) => {
                  setPromptValue(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                className="w-full rounded-md ring-1 ring-zinc-300 dark:ring-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {validationError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {validationError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(isPrompt ? null : false)}
            className="px-3 py-1.5 text-sm rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className={
              "px-3 py-1.5 text-sm rounded-md font-medium text-white transition-colors " +
              (opts.destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts — bottom-right stack, auto-dismiss
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      // pointer-events-none on container so it doesn't block clicks on the
      // page; individual toasts re-enable.
      className="fixed bottom-4 right-4 z-[95] flex flex-col gap-2 pointer-events-none print:hidden"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={
            "pointer-events-auto rounded-lg shadow-lg ring-1 px-3 py-2 text-sm flex items-start gap-2 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-150 " +
            VARIANT_CLASSES[t.variant]
          }
        >
          <span aria-hidden className="text-base leading-tight shrink-0">
            {VARIANT_ICON[t.variant]}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 -m-1 p-1 opacity-60 hover:opacity-100 rounded"
            aria-label="Zavřít"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M3.5 3.5l7 7M10.5 3.5L3.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success:
    "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-100 dark:ring-emerald-900",
  error:
    "bg-red-50 text-red-900 ring-red-200 dark:bg-red-950/80 dark:text-red-100 dark:ring-red-900",
  info:
    "bg-zinc-900 text-white ring-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-300",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};
