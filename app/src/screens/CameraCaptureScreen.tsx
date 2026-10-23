import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { analyzeVehicleMedia, MediaKind } from '../services/imageRecognitionService';
import { runDiagnosis } from '../services/diagnosisService';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CameraCapture'>;

/** Keep in sync with backend MAX_UPLOAD_MB (default 30). */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
/** Keep this in sync with the backend's 5 MB photo limit. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function CameraCaptureScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [kind, setKind] = useState<MediaKind>('photo');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pick = async (source: 'camera' | 'library', mediaKind: MediaKind) => {
    setError(null);

    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Camera permission needed',
            'TorqueDoc needs camera access to photograph or record the problem. You can still choose an existing file from your library.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ]
          );
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Photo library permission needed',
            'Allow access to your photo library to attach an existing photo or video.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ]
          );
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: mediaKind === 'photo' ? ['images'] : ['videos'],
        quality: 0.7,
        videoMaxDuration: 15,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsMultipleSelection: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets[0]) return;

      const selected = result.assets[0];
      const limitBytes = mediaKind === 'photo' ? MAX_PHOTO_BYTES : MAX_UPLOAD_BYTES;
      if (selected.fileSize && selected.fileSize > limitBytes) {
        setError(
          mediaKind === 'photo'
            ? `That photo is ${(selected.fileSize / (1024 * 1024)).toFixed(1)} MB. Photos are limited to 5 MB by the vision API; choose a smaller image or lower the camera resolution.`
            : `That video is ${(selected.fileSize / (1024 * 1024)).toFixed(1)} MB. The limit is 30 MB — try a shorter clip or lower the resolution.`
        );
        return;
      }

      setAsset(selected);
      setKind(mediaKind);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open the camera or photo library. Check app permissions and try again.'
      );
    }
  };

  const handleAnalyze = async () => {
    if (!asset) return;
    setAnalyzing(true);
    setError(null);
    try {
      const analysis = await analyzeVehicleMedia(vehicle.type, {
        uri: asset.uri,
        kind,
        mimeType: asset.mimeType,
        fileName: asset.fileName ?? undefined,
      });

      if (analysis.matchedSymptomIds.length === 0) {
        const labels = analysis.detectedLabels
          .slice(0, 3)
          .map((item) => item.label)
          .join(', ');
        setError(
          analysis.notes ||
            (labels
              ? `We could see ${labels}, but it didn’t map to a known symptom. Try a closer, clearer shot — or use the checklist.`
              : 'Couldn’t identify anything specific in that. Try a clearer shot, or use the checklist instead.')
        );
        return;
      }

      const result = await runDiagnosis(vehicle.type, analysis.matchedSymptomIds, {
        vehicleId: vehicle.id,
        source: 'media',
      });

      navigation.navigate('DiagnosisResult', {
        vehicleId,
        matches: result.matches,
        source: 'media',
        summary: analysis.notes || undefined,
        diagnosisId: result.diagnosisId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong analyzing that.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Capture the problem</Text>
      <Text style={styles.hint}>
        A close-up photo of a leak, warning light, or worn part works best. A short video helps for
        anything that changes over a few seconds, like smoke or a wobbling part. We sample a few
        frames server-side; audio isn’t analyzed.
      </Text>

      {asset ? (
        kind === 'photo' ? (
          <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.videoPreview}>
            <Ionicons name="videocam" size={40} color={colors.accent} />
            <Text style={styles.videoTitle}>Video selected</Text>
            <Text style={styles.videoHint}>
              {asset.duration ? `${Math.round(asset.duration / 1000)}s · ` : ''}
              A few frames will be sampled by the backend.
            </Text>
          </View>
        )
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
          <Text style={styles.placeholderText}>Nothing captured yet</Text>
        </View>
      )}

      <View style={styles.captureRow}>
        <CaptureButton icon="camera" label="Take photo" onPress={() => pick('camera', 'photo')} />
        <CaptureButton icon="videocam" label="Record video" onPress={() => pick('camera', 'video')} />
      </View>
      <View style={styles.captureRow}>
        <CaptureButton
          icon="images-outline"
          label="Choose photo"
          onPress={() => pick('library', 'photo')}
        />
        <CaptureButton
          icon="film-outline"
          label="Choose video"
          onPress={() => pick('library', 'video')}
        />
      </View>

      {error && <ErrorBanner message={error} />}

      <PrimaryButton
        label={analyzing ? 'Analyzing…' : 'Analyze and diagnose'}
        onPress={handleAnalyze}
        loading={analyzing}
        disabled={!asset}
        icon="sparkles-outline"
        style={styles.analyzeButton}
      />

      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          The file is uploaded to your TorqueDoc backend, which sends it to Cloudflare Workers AI
          for analysis. Cloudflare doesn’t train on or retain it, and it isn’t stored on the server
          after the request finishes.
        </Text>
      </View>

      {analyzing && (
        <View style={styles.analyzingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.analyzingText}>Sending to Cloudflare for visual inspection…</Text>
        </View>
      )}
    </ScrollView>
  );
}

function CaptureButton(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
    >
      <Ionicons name={props.icon} size={18} color={colors.textPrimary} />
      <Text style={styles.captureButtonText}>{props.label}</Text>
    </Pressable>
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
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing(4),
  },
  placeholder: {
    height: 220,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
    gap: spacing(2),
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  preview: {
    height: 220,
    borderRadius: radii.md,
    marginBottom: spacing(4),
    backgroundColor: colors.surface,
  },
  videoPreview: {
    height: 220,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
    gap: spacing(2),
    padding: spacing(4),
  },
  videoTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  videoHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    gap: spacing(3),
    marginBottom: spacing(3),
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(3),
  },
  captureButtonPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  captureButtonText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  analyzeButton: {
    marginTop: spacing(2),
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
});
