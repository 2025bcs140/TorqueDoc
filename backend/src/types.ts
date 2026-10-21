export type VehicleType = 'car' | 'motorcycle';

export interface Vehicle {
  id: string;
  type: VehicleType;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  createdAt: string;
}

export type SymptomCategory =
  | 'engine'
  | 'starting_charging'
  | 'brakes'
  | 'cooling'
  | 'exhaust'
  | 'drive_chain_clutch';

export interface Symptom {
  id: string;
  label: string;
  category: SymptomCategory;
  vehicleTypes: VehicleType[];
  causeIds: string[];
}

export type Severity = 'low' | 'medium' | 'high' | 'urgent';

export interface Cause {
  id: string;
  label: string;
  severity: Severity;
  vehicleTypes: VehicleType[];
  repairGuideId: string;
}

export type Difficulty = 'easy' | 'moderate' | 'advanced';

export interface RepairGuide {
  id: string;
  title: string;
  vehicleTypes: VehicleType[];
  category: SymptomCategory;
  difficulty: Difficulty;
  estimatedMinutes: number;
  toolsNeeded: string[];
  steps: string[];
}

/** The subset of a symptom included with a diagnosis, for display. */
export interface MatchedSymptom {
  id: string;
  label: string;
}

export interface DiagnosisMatch {
  cause: Cause;
  /**
   * Share of this cause's known symptoms (for the vehicle type) that the user
   * reported, from 0 to 1. This is reported as coverage, not as a probability
   * that the cause is the fault — see docs/ARCHITECTURE.md.
   */
  confidence: number;
  matchedSymptomIds: string[];
  matchedSymptoms: MatchedSymptom[];
  totalLinkedSymptoms: number;
}

export type DiagnosisSource = 'checklist' | 'free_text' | 'media';

export interface DiagnosisRecord {
  id: string;
  vehicleId: string;
  source: DiagnosisSource;
  symptomIds: string[];
  matches: DiagnosisMatch[];
  createdAt: string;
}
