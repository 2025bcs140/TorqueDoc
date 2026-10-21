import { NavigatorScreenParams } from '@react-navigation/native';
import { DiagnosisMatch, DiagnosisSource } from '../types';

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  AddVehicle: { vehicleId?: string } | undefined;
  VehicleDetail: { vehicleId: string };
  DiagnoseHome: { vehicleId: string };
  SymptomChecklist: { vehicleId: string };
  FreeTextSymptom: { vehicleId: string };
  CameraCapture: { vehicleId: string };
  DiagnosisResult: {
    vehicleId: string;
    matches: DiagnosisMatch[];
    source: DiagnosisSource;
    /** One-line restatement from the AI when the run started from free text. */
    summary?: string;
    /** Set when the backend logged the run against the vehicle. */
    diagnosisId?: string | null;
  };
  HistoryDetail: { diagnosisId: string };
  RepairGuideDetail: { repairGuideId: string };
  History: { vehicleId: string };
};

export type TabParamList = {
  Garage: undefined;
  Library: undefined;
};
