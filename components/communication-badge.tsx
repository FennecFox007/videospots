// Visual badge for the campaign's communication intent (preorder / launch /
// outnow / dlc / update / promo / sale / bundle / brand). Read-only — used
// on detail / list / share / print views.
//
// Built on the shared <Pill> primitive. Communication-type colors live in
// lib/communication.ts (richer palette than Pill's tone enum can model)
// so we pass them as className.

import { Pill } from "@/components/ui/pill";
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
  const colorClasses = communicationTypeClasses(type);
  return (
    <Pill size="sm" className={`${colorClasses} ${className}`}>
      <span title="Typ komunikace">{communicationTypeLabel(type)}</span>
    </Pill>
  );
}
