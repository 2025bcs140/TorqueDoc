import { Platform } from 'react-native';
import { AI_TIMEOUT_MS, apiFetch } from './apiClient';
import { VehicleType } from '../types';

export type MediaKind = 'photo' | 'video' | 'audio';

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

const FALLBACKS: Record<MediaKind, { name: string; type: string }> = {
  photo: { name: 'capture.jpg', type: 'image/jpeg' },
  video: { name: 'capture.mp4', type: 'video/mp4' },
  audio: { name: 'recording.m4a', type: 'audio/m4a' },
};

/**
 * Uploads a captured photo, short video, or sound clip for analysis. Video
 * frame extraction and audio transcoding (ffmpeg) happen server-side, so the
 * app simply uploads the original file.
 *
 * `context` is only used for audio: a short note such as "when braking" that
 * helps the audio model distinguish similar sounds.
 */
export async function analyzeVehicleMedia(
  vehicleType: VehicleType,
  asset: MediaAsset,
  options?: { context?: string }
): Promise<MediaAnalysisResult> {
  const form = new FormData();
  form.append('vehicleType', vehicleType);
  form.append('kind', asset.kind);
  if (asset.kind === 'audio' && options?.context) {
    form.append('context', options.context);
  }

  const fallback = FALLBACKS[asset.kind];
  const fallbackName = fallback.name;
  const fallbackType = fallback.type;

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
