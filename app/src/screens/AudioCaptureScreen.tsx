import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import {
  analyzeVehicleMedia,
  MediaAnalysisResult,
} from '../services/imageRecognitionService';
import { runDiagnosis } from '../services/diagnosisService';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  colors,
  gradients,
  radii,
  shadows,
  spacing,
  typography,
} from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AudioCapture'>;

const MAX_SECONDS = 30;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const CONTEXTS = [
  'At idle',
  'When revving',
  'When braking',
  'When turning',
  'When starting',
  'Not sure',
] as const;

interface AudioAsset {
  uri: string;
  mimeType: string;
  fileName: string;
  size?: number;
  file?: File;
}

function formatDuration(milliseconds: number): string {
  const total = Math.min(MAX_SECONDS, Math.max(0, Math.floor(milliseconds / 1000)));
  return `0:${String(total).padStart(2, '0')}`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  if (mimeType.includes('aac')) return 'aac';
  return 'm4a';
}

function guessMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/m4a';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/m4a';
  }
}

export function AudioCaptureScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150);

  const [context, setContext] = useState<string>('At idle');
  const [asset, setAsset] = useState<AudioAsset | null>(null);
  const [analysis, setAnalysis] = useState<MediaAnalysisResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopRecording = useCallback(async () => {
    if (!recorder.isRecording || stopping) return;
    setStopping(true);
    setError(null);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('The recording did not produce an audio file.');

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        if (!response.ok) throw new Error('Could not read the recording.');
        const blob = await response.blob();
        // MediaRecorder can report `audio/webm;codecs=opus`; the backend wants
        // the base media type and probes the container with ffmpeg.
        const mimeType = (blob.type || 'audio/webm').split(';')[0].trim();
        const fileName = `engine-sound-${Date.now()}.${extensionForMime(mimeType)}`;
        const file = new File([blob], fileName, { type: mimeType });
        setAsset({ uri, mimeType, fileName, size: file.size, file });
      } else {
        const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
        setAsset({
          uri,
          mimeType,
          fileName: `engine-sound-${Date.now()}.m4a`,
        });
      }
      setAnalysis(null);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the recording.');
    } finally {
      setStopping(false);
    }
  }, [recorder, stopping]);

  // Stop automatically at 30 seconds. The backend trims again as a safety net.
  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= MAX_SECONDS * 1000) {
      void stopRecording();
    }
  }, [recorderState.durationMillis, recorderState.isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recorder.isRecording) {
        void recorder.stop().catch(() => undefined);
      }
    };
  }, [recorder]);

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="car-outline"
          title="Vehicle not found"
          message="Go back to the garage and choose a vehicle."
          actionLabel="Back to garage"
          onAction={() => navigation.navigate('Main', { screen: 'Garage' })}
        />
      </View>
    );
  }

  const startRecording = async () => {
    if (starting || stopping) return;
    setError(null);
    setAsset(null);
    setAnalysis(null);
    setStarting(true);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone permission needed',
          'TorqueDoc needs microphone access to record an engine, brake, chain or exhaust noise. You can still choose an existing audio file.',
          Platform.OS === 'web'
            ? [{ text: 'OK' }]
            : [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open settings', onPress: () => void Linking.openSettings() },
              ]
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start recording. Check microphone permission and try again.'
      );
    } finally {
      setStarting(false);
    }
  };

  const pickAudioFile = async () => {
    setError(null);
    setAnalysis(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const selected = result.assets[0];
      if (selected.size && selected.size > MAX_AUDIO_BYTES) {
        setError(
          `That file is ${(selected.size / (1024 * 1024)).toFixed(1)} MB. Audio files are limited to 20 MB; try a shorter clip.`
        );
        return;
      }

      const mimeType = (selected.mimeType || guessMimeType(selected.name))
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (mimeType.startsWith('video/')) {
        setError('Choose an audio recording rather than a video file.');
        return;
      }

      setAsset({
        uri: selected.uri,
        mimeType,
        fileName: selected.name || `engine-sound.${extensionForMime(mimeType)}`,
        size: selected.size,
        file: selected.file,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file picker.');
    }
  };

  const handleAnalyze = async () => {
    if (!asset || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeVehicleMedia(
        vehicle.type,
        {
          uri: asset.uri,
          kind: 'audio',
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          file: asset.file,
        },
        { context }
      );
      setAnalysis(result);

      if (result.matchedSymptomIds.length === 0) {
        return;
      }

      const diagnosis = await runDiagnosis(vehicle.type, result.matchedSymptomIds, {
        vehicleId: vehicle.id,
        source: 'audio',
      });

      navigation.navigate('DiagnosisResult', {
        vehicleId,
        matches: diagnosis.matches,
        source: 'audio',
        summary: result.notes || undefined,
        diagnosisId: diagnosis.diagnosisId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong analyzing that sound.');
    } finally {
      setAnalyzing(false);
    }
  };

  const isRecording = recorderState.isRecording;
  const duration = formatDuration(recorderState.durationMillis);
  const topLabel = analysis?.detectedLabels[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SOUND ANALYSIS</Text>
      <Text style={styles.title}>Let TorqueDoc listen.</Text>
      <Text style={styles.hint}>
        Record up to {MAX_SECONDS} seconds near the suspected area. The backend transcodes the clip
        to a small WAV, then Cloudflare’s audio model identifies mechanical sound patterns. It is
        not a voice assistant and does not diagnose from speech.
      </Text>

      <View style={styles.contextSection}>
        <Text style={styles.sectionLabel}>When do you hear it?</Text>
        <View style={styles.chips}>
          {CONTEXTS.map((item) => {
            const selected = context === item;
            return (
              <Pressable
                key={item}
                onPress={() => setContext(item)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recorderPanel}
      >
        <View style={styles.recorderTop}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, isRecording && styles.liveDotActive]} />
            <Text style={styles.liveText}>{isRecording ? 'RECORDING' : 'READY'}</Text>
          </View>
          <Text style={styles.timer}>{duration}</Text>
          <Text style={styles.timerLimit}>/ 0:{MAX_SECONDS}</Text>
        </View>

        <View style={styles.waveform} pointerEvents="none">
          {[14, 26, 18, 38, 24, 46, 30, 20, 34, 16, 28, 42, 22, 32, 18, 24].map((height, index) => (
            <View
              key={`${height}-${index}`}
              style={[
                styles.waveBar,
                { height: isRecording ? height : Math.max(6, height * 0.35) },
                isRecording && styles.waveBarActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={isRecording ? () => void stopRecording() : startRecording}
          disabled={starting || stopping}
          style={({ pressed }) => [styles.recordButtonWrap, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <LinearGradient
            colors={isRecording ? [colors.danger, '#B91C1C'] : gradients.accent}
            style={styles.recordButton}
          >
            {starting || stopping ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={32}
                color={isRecording ? colors.textPrimary : colors.background}
              />
            )}
          </LinearGradient>
        </Pressable>
        <Text style={styles.recordHint}>
          {isRecording ? 'Stop recording, or wait for the 30-second limit.' : 'Start recording'}
        </Text>

        <Pressable
          onPress={() => void pickAudioFile()}
          style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Choose an audio file"
        >
          <Ionicons name="folder-open-outline" size={17} color={colors.cyan} />
          <Text style={styles.fileButtonText}>Choose an audio file instead</Text>
        </Pressable>
      </LinearGradient>

      {asset && (
        <View style={styles.assetCard}>
          <View style={styles.assetIcon}>
            <Ionicons name="musical-notes" size={20} color={colors.accent} />
          </View>
          <View style={styles.assetText}>
            <Text style={styles.assetTitle} numberOfLines={1}>
              {asset.fileName}
            </Text>
            <Text style={styles.assetMeta}>
              {context}
              {asset.size ? ` · ${(asset.size / (1024 * 1024)).toFixed(1)} MB` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setAsset(null);
              setAnalysis(null);
              setError(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove audio clip"
          >
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {error && <ErrorBanner message={error} />}

      {analysis && analysis.matchedSymptomIds.length === 0 && (
        <View style={styles.analysisCard}>
          <View style={styles.analysisHead}>
            <View style={styles.analysisIcon}>
              <Ionicons name="ear-outline" size={22} color={colors.cyan} />
            </View>
            <View style={styles.analysisHeadText}>
              <Text style={styles.analysisEyebrow}>SOUND IDENTIFIED</Text>
              <Text style={styles.analysisTitle}>{topLabel?.label ?? 'No clear match'}</Text>
            </View>
            {topLabel && (
              <Text style={styles.confidence}>{Math.round(topLabel.confidence * 100)}%</Text>
            )}
          </View>
          <Text style={styles.analysisNotes}>{analysis.notes}</Text>
          {analysis.detectedLabels.length > 1 && (
            <View style={styles.labelRow}>
              {analysis.detectedLabels.slice(0, 3).map((label) => (
                <View key={label.label} style={styles.labelChip}>
                  <Text style={styles.labelChipText}>{label.label}</Text>
                  <Text style={styles.labelChipConfidence}>
                    {Math.round(label.confidence * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.analysisActions}>
            <PrimaryButton
              label="Open symptom checklist"
              onPress={() => navigation.navigate('SymptomChecklist', { vehicleId })}
              variant="secondary"
              icon="list-outline"
            />
            <PrimaryButton
              label="Try another clip"
              onPress={() => {
                setAsset(null);
                setAnalysis(null);
              }}
              icon="mic-outline"
            />
          </View>
        </View>
      )}

      <PrimaryButton
        label={analyzing ? 'Analyzing sound…' : 'Analyze this sound'}
        onPress={() => void handleAnalyze()}
        loading={analyzing}
        disabled={!asset || isRecording}
        icon="sparkles-outline"
        style={styles.analyzeButton}
      />

      {analyzing && (
        <View style={styles.analyzingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.analyzingText}>Sending the clip to Cloudflare for sound analysis…</Text>
        </View>
      )}

      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          The recording is uploaded to your TorqueDoc backend and transcoded to mono 16 kHz WAV for
          Cloudflare Workers AI. Cloudflare does not train on or retain the clip, and the server
          does not store it after the request. Avoid recording conversations or personal
          information.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.cyan,
    marginBottom: spacing(2),
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing(5),
  },
  contextSection: {
    marginBottom: spacing(4),
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing(2),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  recorderPanel: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.18)',
    padding: spacing(5),
    alignItems: 'center',
    marginBottom: spacing(4),
    overflow: 'hidden',
    ...shadows.card,
  },
  recorderTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing(4),
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  liveDotActive: {
    backgroundColor: colors.danger,
  },
  liveText: {
    ...typography.eyebrow,
    color: colors.textMuted,
    fontSize: 9,
  },
  timer: {
    ...typography.mono,
    color: colors.textPrimary,
    fontSize: 15,
    marginLeft: 'auto',
  },
  timerLimit: {
    ...typography.mono,
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: spacing(1),
  },
  waveform: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing(4),
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  waveBarActive: {
    backgroundColor: colors.accent,
  },
  recordButtonWrap: {
    borderRadius: radii.pill,
    ...shadows.glow,
  },
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(8, 13, 19, 0.55)',
  },
  recordHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing(2),
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    backgroundColor: 'rgba(34, 211, 238, 0.06)',
  },
  fileButtonText: {
    ...typography.caption,
    color: colors.cyan,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3),
    marginBottom: spacing(4),
  },
  assetIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  assetText: {
    flex: 1,
  },
  assetTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  assetMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  analyzeButton: {
    marginTop: spacing(1),
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  analyzingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.24)',
    borderRadius: radii.lg,
    padding: spacing(4),
    marginBottom: spacing(4),
    ...shadows.card,
  },
  analysisHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  analysisIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
  },
  analysisHeadText: {
    flex: 1,
  },
  analysisEyebrow: {
    ...typography.eyebrow,
    color: colors.cyan,
    fontSize: 9,
  },
  analysisTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginTop: 2,
  },
  confidence: {
    ...typography.subheading,
    color: colors.cyan,
  },
  analysisNotes: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: spacing(3),
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  labelChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  labelChipConfidence: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  analysisActions: {
    gap: spacing(2),
    marginTop: spacing(4),
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
    padding: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
