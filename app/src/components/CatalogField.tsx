import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  options: string[];
  loading?: boolean;
  error?: string;
  helperText?: string;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/**
 * A text field that also opens a searchable list. Manual entry stays available
 * on every platform, which matters when a make or model is missing from the
 * live catalog or the device is offline.
 */
export function CatalogField({
  label,
  value,
  onChangeText,
  placeholder,
  options,
  loading = false,
  error,
  helperText,
  maxLength = 60,
  autoCapitalize = 'words',
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, search]);

  const select = (option: string) => {
    onChangeText(option);
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.catalogHint}>{options.length > 0 ? `${options.length} picks` : 'Type manually'}</Text>
      </View>

      <View style={[styles.inputRow, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={label}
        />
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.browseButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Browse ${label.toLowerCase()} options`}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="chevron-down" size={18} color={colors.accent} />
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close picker"
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(3) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetEyebrow}>CATALOG</Text>
                <Text style={styles.sheetTitle}>Choose {label.toLowerCase()}</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close picker"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${label.toLowerCase()}s`}
                placeholderTextColor={colors.textMuted}
                autoFocus
                autoCorrect={false}
                accessibilityLabel={`Search ${label.toLowerCase()}s`}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {loading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.emptyText}>Loading the live catalog...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="create-outline" size={24} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No match in the list</Text>
                <Text style={styles.emptyText}>
                  Close this picker and type the value in the field. Manual entry is always
                  accepted.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                initialNumToRender={18}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => select(item)}
                    style={({ pressed }) => [
                      styles.option,
                      item.toLowerCase() === value.trim().toLowerCase() && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item}`}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        item.toLowerCase() === value.trim().toLowerCase() &&
                          styles.optionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {item.toLowerCase() === value.trim().toLowerCase() && (
                      <Ionicons name="checkmark" size={18} color={colors.accent} />
                    )}
                  </Pressable>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    marginBottom: spacing(4),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  catalogHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing(3),
  },
  inputError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    paddingVertical: spacing(3),
    color: colors.textPrimary,
    ...typography.body,
  },
  browseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing(1),
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing(1),
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: colors.surfaceSoft,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing(3),
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  sheetTitleWrap: {
    flex: 1,
  },
  sheetEyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    fontSize: 9,
  },
  sheetTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(3),
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing(3),
    color: colors.textPrimary,
    ...typography.body,
  },
  list: {
    marginBottom: spacing(1),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(3) + 2,
    paddingHorizontal: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: {
    backgroundColor: 'rgba(255, 176, 32, 0.08)',
    borderRadius: radii.sm,
  },
  optionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  optionTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(8),
    paddingHorizontal: spacing(5),
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.8,
  },
});
