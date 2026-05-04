"use client";

// Tiny module-level store for the campaign peek panel.
//
// Exposed surface:
//   openCampaignPeek(id)      — open / switch the panel to a given campaign
//   closeCampaignPeek()       — close
//   refreshCampaignPeek()     — keep the panel open but force a refetch
//                               (used after server actions mutate data)
//   subscribeToPeek(listener) — listen for state changes
//   getPeekState()            — current snapshot
//   hydratePeekFromUrl()      — read ?peek=<id> from window.location once
//                               on app boot, so reloads / shared URLs work
//
// State shape: { id, gen }. `gen` bumps on every transition AND on every
// refresh, so subscribers can effect-depend on `[id, gen]` to refetch when
// the panel is told to refresh while staying on the same id.
//
// URL sync uses history.replaceState — peek changes are navigation noise,
// not real history entries the user would want to "back" through.
//
// Why no Context / Zustand: the store is a single nullable id + a counter.
// A 60-line module is plenty and avoids forcing every caller into a Provider.
//
// Why no Next.js routing: this used to be an intercepting route at
// app/@modal/(.)campaigns/[id]/, but Next.js 16 + Turbopack was crashing the
// dev server under HMR with two intercepts at the same level. Imperative
// store + plain fetch keeps the panel off Next's routing surface entirely.

type State = { id: number | null; gen: number };
type Listener = (state: State) => void;

let state: State = { id: null, gen: 0 };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function syncUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (state.id == null) {
    url.searchParams.delete("peek");
  } else {
    url.searchParams.set("peek", String(state.id));
  }
  // Preserve the existing history.state so React's router doesn't lose its
  // place (Next stores tree info there).
  window.history.replaceState(window.history.state, "", url.toString());
}

export function openCampaignPeek(id: number) {
  if (state.id === id) return;
  state = { id, gen: state.gen + 1 };
  syncUrl();
  emit();
}

export function closeCampaignPeek() {
  if (state.id === null) return;
  state = { id: null, gen: state.gen + 1 };
  syncUrl();
  emit();
}

/** Force a refetch without changing the panel's id. */
export function refreshCampaignPeek() {
  if (state.id === null) return;
  state = { ...state, gen: state.gen + 1 };
  emit();
}

export function getPeekState(): State {
  return state;
}

export function subscribeToPeek(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Read `?peek=<id>` from the URL and open the panel if present. Idempotent —
 * safe to call multiple times. Mounted-once from <CampaignPeek /> so reloads
 * and shared URLs land with the panel already open.
 */
export function hydratePeekFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const peek = params.get("peek");
  if (!peek) return;
  const id = Number(peek);
  if (!Number.isFinite(id)) return;
  if (state.id === id) return;
  state = { id, gen: state.gen + 1 };
  emit();
}
