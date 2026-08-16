export type ReservationPolicy = {
  applies: boolean;
  types: string[];
  label: string | null;
  acceptsSingleOpenFallback: boolean;
};

export function reservePolicy(groupCode: number | null | undefined, machineDescription: string | null | undefined, environment?: Record<string, string | undefined>): ReservationPolicy;
export function selectApplicableReservations<T extends { type?: unknown }>(reservations: T[], policy: ReservationPolicy): T[];
