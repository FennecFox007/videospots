"use client";

// Tiny module-level store that connects two unrelated bits of UI: the
// drop handler on a Timeline channel row, and the create-campaign modal
// that should open after a successful drop. Same shape as peek-store —
// listeners + emit, no Provider needed.
//
// The drop handler builds a PendingDrop object with everything the modal
// needs (which spot, which channel, which country, what date) and calls
// setPendingDrop. The modal is mounted once at the page level, listens for
// the store, and opens with that payload. Cancel / submit clear the store.

export type PendingDrop = {
  spotId: number;
  spotName: string;
  spotProductName: string | null;
  /** Country the spot is bound to and the channel belongs to — same value,
   *  carried twice on purpose so the modal can avoid re-fetching. */
  countryId: number;
  countryCode: string;
  countryFlag: string | null;
  countryName: string;
  /** The channel the user actually dropped on. Pre-checked in the modal. */
  channelId: number;
  channelName: string;
  /** Day the bar should start at, derived from drop x within the track.
   *  Snapped to whole day; the modal lets the user adjust + pick an end. */
  startDate: Date;
};

type Listener = (drop: PendingDrop | null) => void;

let pending: PendingDrop | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(pending);
}

export function setPendingDrop(d: PendingDrop) {
  pending = d;
  emit();
}

export function clearPendingDrop() {
  if (pending === null) return;
  pending = null;
  emit();
}

export function getPendingDrop(): PendingDrop | null {
  return pending;
}

export function subscribePendingDrop(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** MIME type used in HTML5 dataTransfer to flag our spot drag payload —
 *  unique enough that other drag sources won't collide. The drop handler
 *  reads this in dataTransfer.getData() and parses the JSON. */
export const SPOT_DRAG_MIME = "application/x-videospots-spot";

/** Payload encoded into dataTransfer when a spot card starts dragging.
 *  The drop handler validates countryId match before showing the modal. */
export type SpotDragPayload = {
  spotId: number;
  spotName: string;
  spotProductName: string | null;
  countryId: number;
  countryCode: string;
  countryFlag: string | null;
  countryName: string;
};
