/** Allowed single-step design status promotions (matches strataforge/core/status.py). */
export const STATUS_CHAIN = [
  "scaffolded",
  "expanded",
  "reconciled",
  "execution_ready",
] as const;

export type DesignStatusStep = (typeof STATUS_CHAIN)[number];

export function nextDesignStatus(current: string): DesignStatusStep | null {
  const idx = STATUS_CHAIN.indexOf(current as DesignStatusStep);
  if (idx < 0 || idx >= STATUS_CHAIN.length - 1) return null;
  return STATUS_CHAIN[idx + 1];
}

export function advanceStatusLabel(current: string): string {
  const next = nextDesignStatus(current);
  if (!next) return "At maximum MVP status";
  return `Advance to ${next.replace("_", " ")}`;
}
