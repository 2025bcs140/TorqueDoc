export type VehicleType = 'car' | 'motorcycle';

export interface Vehicle {
  id: string;
  type: VehicleType;
  nickname?: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  createdAt: string;
}

export type VehiclePatch = Partial<Pick<Vehicle, 'type' | 'make' | 'model' | 'year' | 'mileage'>> & {
  nickname?: string | null;
};

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

export interface RepairGuide {
  id: string;
  title: string;
  vehicleTypes: VehicleType[];
  category: SymptomCategory;
  difficulty: 'easy' | 'moderate' | 'advanced';
  estimatedMinutes: number;
  toolsNeeded: string[];
  steps: string[];
}

export interface MatchedSymptom {
  id: string;
  label: string;
}

export interface DiagnosisMatch {
  cause: Cause;
  /** 0–1 coverage of this cause's known signs, not a probability. */
  confidence: number;
  matchedSymptomIds: string[];
  /** Present on new records; optional so old history rows still render. */
  matchedSymptoms?: MatchedSymptom[];
  totalLinkedSymptoms?: number;
}

/** How the person entered symptoms for a given diagnosis run. */
export type DiagnosisSource = 'checklist' | 'free_text' | 'media';

export interface DiagnosisRecord {
  id: string;
  vehicleId: string;
  source: DiagnosisSource;
  symptomIds: string[];
  matches: DiagnosisMatch[];
  createdAt: string;
}

export interface DiagnosisRunResult {
  matches: DiagnosisMatch[];
  diagnosisId: string | null;
}
