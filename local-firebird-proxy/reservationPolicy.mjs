function groupCodesFromEnv(name, environment) {
  return (environment[name] ?? "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
}

export function reservePolicy(groupCode, machineDescription, environment = process.env) {
  const cortadaGroups = groupCodesFromEnv("FIREBIRD_RESERVE_CORTADA_GROUPS", environment);
  const riscadorGroups = groupCodesFromEnv("FIREBIRD_RESERVE_RISCADOR_GROUPS", environment);
  const normalizedGroup = Number(groupCode);
  const label = String(machineDescription ?? "").toUpperCase();
  if (normalizedGroup === 1 || riscadorGroups.includes(normalizedGroup)) return { applies: true, types: ["ABERTA", "REVINCADA"], label: "Aberta ou Revincada", acceptsSingleOpenFallback: false };
  if (normalizedGroup === 3) return { applies: true, types: ["CORTADA/VINCADA", "APROVEITAMENTO"], label: "Cortada/Vincada ou Aproveitamento", acceptsSingleOpenFallback: true };
  if (normalizedGroup === 2) return { applies: true, types: ["CORTADA/VINCADA", ""], label: "Cortada/Vincada", acceptsSingleOpenFallback: true };
  if (cortadaGroups.includes(normalizedGroup) || (!cortadaGroups.length && /IMPRESS|CORTE|VINCO/.test(label))) return { applies: true, types: ["CORTADA/VINCADA", "APROVEITAMENTO"], label: "Cortada/Vincada ou Aproveitamento", acceptsSingleOpenFallback: true };
  if (!riscadorGroups.length && /RISC/.test(label)) return { applies: true, types: ["ABERTA", "REVINCADA"], label: "Aberta ou Revincada", acceptsSingleOpenFallback: false };
  return { applies: false, types: [], label: null, acceptsSingleOpenFallback: false };
}

export function selectApplicableReservations(reservations, policy) {
  const typedReservations = reservations.filter((reservation) => policy.types.includes(String(reservation.type ?? "").trim().toUpperCase()));
  if (typedReservations.length > 0) return typedReservations;
  return policy.acceptsSingleOpenFallback && reservations.length === 1 ? reservations : [];
}
