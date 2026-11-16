/**
 * Every asset TorqueDoc can keep in a garage. Cars and motorcycles use the
 * vehicle symptom catalog; the three machine types use the industrial
 * equipment catalog. Keeping this as one union lets diagnosis, history and
 * account isolation share the same storage path.
 */
export const VEHICLE_TYPES = [
  'car',
  'motorcycle',
  'drilling_machine',
  'milling_machine',
  'lifting_machine',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type MachineVehicleType = Exclude<VehicleType, 'car' | 'motorcycle'>;

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  drilling_machine: 'Drilling machine',
  milling_machine: 'Milling machine',
  lifting_machine: 'Lifting machine',
};

export const VEHICLE_CATEGORIES = {
  car: 'vehicle',
  motorcycle: 'vehicle',
  drilling_machine: 'machine',
  milling_machine: 'machine',
  lifting_machine: 'machine',
} as const satisfies Record<VehicleType, 'vehicle' | 'machine'>;

export function isMachineType(type: VehicleType): type is MachineVehicleType {
  return VEHICLE_CATEGORIES[type] === 'machine';
}

/**
 * A signed-in TorqueDoc account. Password hashes and session hashes never leave
 * the server; this is the only user shape returned by the API.
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

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
  | 'drive_chain_clutch'
  | 'spindle_drive'
  | 'lubrication_coolant'
  | 'hydraulics'
  | 'controls_electrical'
  | 'structure_safety';

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

export type DiagnosisSource = 'checklist' | 'free_text' | 'media' | 'audio';

export interface DiagnosisRecord {
  id: string;
  vehicleId: string;
  source: DiagnosisSource;
  symptomIds: string[];
  matches: DiagnosisMatch[];
  createdAt: string;
}
