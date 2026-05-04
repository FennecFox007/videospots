// Tiny module-level store for the campaign peek panel. Avoids React Context
// (which would force every consumer to live under a Provider) and Zustand
// (which is overkill for a single nullable id). Anyone in the client bundle
// can call openCampaignPeek(id) / closeCampaignPeek(); the <CampaignPeek />
// listener mounted in the root layout reacts to it.
//
// Why not URL-driven? We tried — the @modal slot + (.)campaigns/[id]
// intercepting route was crashing the dev server under Turbopack HMR, so we
// moved off URL state entirely. The trade-off is that the peek is no longer
// shareable via URL; the full /campaigns/[id] page is.

"use client";

type Listener = (id: number | null) => void;

const listeners = new Set<Listener>();
let currentId: number | null = null;

export function openCampaignPeek(id: number) {
  if (currentId === id) return;
  currentId = id;
  for (const l of listeners) l(currentId);
}

export function closeCampaignPeek() {
  if (currentId === null) return;
  currentId = null;
  for (const l of listeners) l(currentId);
}

export function getCurrentPeekId(): number | null {
  return currentId;
}

export function subscribeToPeek(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
