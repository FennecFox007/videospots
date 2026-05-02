// Visual badge for the campaign's communication intent (preorder / launch /
// outnow / dlc / update / promo / sale / bundle / brand). Read-only — used
// on detail / list / share / print views.

import {
  communicationTypeLabel,
  communicationTypeClasses,
} from "@/lib/communication";

export function CommunicationBadge({
  type,
  className = "",
}: {
  type: string | null | undefined;
  className?: string;
}) {
  if (!type) return null;
  const classes = communicationTypeClasses(type);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
      title="Typ komunikace"
    >
      {communicationTypeLabel(type)}
    </span>
  );
}
