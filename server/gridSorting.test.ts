import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ordenação de grids", () => {
  it("mantém um utilitário comum e ações ordenáveis em todos os grids operacionais", () => {
    const primitives = readFileSync(resolve(process.cwd(), "client/src/components/ProductionPrimitives.tsx"), "utf8");
    const files = [
      "client/src/pages/Programming.tsx",
      "client/src/components/QueueConsultationDialog.tsx",
      "client/src/components/ProductReservationDialog.tsx",
      "client/src/components/ApprovedProcessQuantitiesDialog.tsx",
      "client/src/components/SpecialProductionDialog.tsx",
      "client/src/components/SpecialProductionPanel.tsx",
    ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));

    expect(primitives).toContain("export function useGridSort");
    expect(primitives).toContain("export function SortableHeader");
    expect(primitives).toContain("export function SortableGridButton");
    for (const source of files) {
      expect(source).toMatch(/SortableHeader|SortableGridButton/);
      expect(source).toContain("useGridSort");
    }
  });
});
