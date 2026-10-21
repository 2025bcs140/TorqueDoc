import { Cause, DiagnosisMatch, Symptom, VehicleType } from '../types';

export interface CatalogSnapshot {
  symptoms: Symptom[];
  causes: Cause[];
}

const SEVERITY_RANK = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

/**
 * Deterministic, explainable rule engine.
 *
 * For every cause that applies to the vehicle type, `confidence` is the share
 * of that cause's known symptoms that the user reported. It is deliberately
 * *coverage*, not a probability: a cause with one known symptom can reach
 * 100% from a single checkbox. The UI therefore shows "2 of 3 matching signs"
 * alongside the percentage, and docs/ARCHITECTURE.md explains the trade-off.
 *
 * Important: only symptoms that apply to the same vehicle type are counted.
 * Before this was fixed, a motorcycle diagnosis counted car-only symptoms as
 * "missing", which silently diluted every confidence score.
 *
 * The function is pure so it can be unit-tested without a database.
 */
export function diagnose(
  selectedSymptomIds: string[],
  vehicleType: VehicleType,
  catalog: CatalogSnapshot
): DiagnosisMatch[] {
  if (selectedSymptomIds.length === 0) return [];

  const selected = new Set(selectedSymptomIds);

  const applicableSymptoms = catalog.symptoms.filter((symptom) =>
    symptom.vehicleTypes.includes(vehicleType)
  );
  const applicableCauses = catalog.causes.filter((cause) =>
    cause.vehicleTypes.includes(vehicleType)
  );

  return applicableCauses
    .map((cause): DiagnosisMatch | null => {
      const linked = applicableSymptoms.filter((symptom) => symptom.causeIds.includes(cause.id));
      if (linked.length === 0) return null;

      const matched = linked.filter((symptom) => selected.has(symptom.id));
      if (matched.length === 0) return null;

      return {
        cause,
        confidence: matched.length / linked.length,
        matchedSymptomIds: matched.map((symptom) => symptom.id),
        matchedSymptoms: matched.map((symptom) => ({ id: symptom.id, label: symptom.label })),
        totalLinkedSymptoms: linked.length,
      };
    })
    .filter((match): match is DiagnosisMatch => match !== null)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.matchedSymptomIds.length - a.matchedSymptomIds.length ||
        SEVERITY_RANK[b.cause.severity] - SEVERITY_RANK[a.cause.severity] ||
        a.cause.label.localeCompare(b.cause.label)
    );
}

/**
 * Returns the ids that are not valid symptoms for this vehicle type.
 * Route handlers use this to reject typos instead of silently diagnosing
 * from a partial selection.
 */
export function findUnknownSymptomIds(
  selectedSymptomIds: string[],
  vehicleType: VehicleType,
  catalog: CatalogSnapshot
): string[] {
  const known = new Set(
    catalog.symptoms
      .filter((symptom) => symptom.vehicleTypes.includes(vehicleType))
      .map((symptom) => symptom.id)
  );
  return selectedSymptomIds.filter((id) => !known.has(id));
}
