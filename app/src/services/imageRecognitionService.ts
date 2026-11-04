import { Platform } from 'react-native';
import { AI_TIMEOUT_MS, apiFetch } from './apiClient';
import { VehicleType } from '../types';

export type MediaKind = 'photo' | 'video';

export interface MediaAnalysisResult {
  matchedSymptomIds: string[];
  detectedLabels: { label: string; confidence: number }[];
  notes: string;
}

export interface MediaAsset {
  uri: string;
  kind: MediaKind;
  /** From expo-image-picker's asset; used so HEIC/QuickTime are labelled correctly. */
  mimeType?: string;
  fileName?: string;
  /** expo-image-picker provides the browser File on web. */
  file?: File;
}

/**
 * Uploads a captured photo or short video for vision analysis. Video frame
 * extraction (ffmpeg) happens server-side, so the app simply uploads the file.
 */
export async function analyzeVehicleMedia(
  vehicleType: VehicleType,
  asset: MediaAsset
): Promise<MediaAnalysisResult> {
  const form = new FormData();
  form.append('vehicleType', vehicleType);
  form.append('kind', asset.kind);

  const fallbackName = asset.kind === 'photo' ? 'capture.jpg' : 'capture.mp4';
  const fallbackType = asset.kind === 'photo' ? 'image/jpeg' : 'video/mp4';

  if (Platform.OS === 'web') {
    // Browsers need a real File/Blob. React Native's { uri, name, type }
    // object is serialized as "[object Object]" by the web FormData
    // implementation, so the backend receives no file at all.
    let file = asset.file;
    if (!file) {
      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error('Could not read the selected file. Try choosing it again.');
      }
      const blob = await response.blob();
      file = new File([blob], asset.fileName || fallbackName, {
        type: asset.mimeType || blob.type || fallbackType,
      });
    }
    form.append('file', file, asset.fileName || file.name || fallbackName);
  } else {
    // @ts-expect-error React Native's fetch accepts this file-shaped object; DOM lib types don't know that
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || fallbackName,
      type: asset.mimeType || fallbackType,
    });
  }

  return apiFetch<MediaAnalysisResult>(
    '/v1/media/analyze',
    { method: 'POST', body: form },
    { timeoutMs: AI_TIMEOUT_MS }
  );
}
