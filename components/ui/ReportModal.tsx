import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';
import {
  REPORT_CATEGORIES,
  ReportCategory,
  saveCommunityReport,
} from '@/utils/communityReports';
import { addPoints } from '@/utils/commuterPoints';
import { ALL_STATIONS } from '@/constants/stations';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onReportSubmitted?: () => void;
  defaultStationId?: string;
}

export function ReportModal({
  visible,
  onClose,
  onReportSubmitted,
  defaultStationId,
}: ReportModalProps) {
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStation, setSelectedStation] = useState(
    defaultStationId || 'mrt3-ayala'
  );

  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 400,
          duration: 250,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  const handleSubmit = async () => {
    if (!selected) return;
    const station = ALL_STATIONS.find((s) => s.id === selectedStation);
    if (!station) return;

    setSubmitting(true);
    try {
      await saveCommunityReport(selected, station.id, station.name, station.line);
      await addPoints(15, 'report');
      setSelected(null);
      onReportSubmitted?.();
      onClose();
      Alert.alert(
        '✅ Report Submitted!',
        `Thanks for reporting! You earned +15 Commuter Points.`,
        [{ text: 'Awesome!' }]
      );
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const popularStations = ALL_STATIONS.filter((s) =>
    [
      'mrt3-ayala',
      'mrt3-araneta-cubao',
      'lrt1-doroteo-jose',
      'lrt2-araneta-cubao',
      'mrt3-north-avenue',
    ].includes(s.id)
  );

  const categories = Object.entries(REPORT_CATEGORIES) as [
    ReportCategory,
    { label: string; icon: string; color: string }
  ][];

  const BackdropComponent = Platform.OS !== 'web' ? BlurView : View;
  const backdropProps =
    Platform.OS !== 'web'
      ? { intensity: 20, tint: 'dark' as const, style: styles.backdrop }
      : { style: [styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }] };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BackdropComponent {...backdropProps} />
      </Pressable>

      <RNAnimated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>📢 Quick Report</Text>
            <Text style={styles.subtitle}>Help fellow commuters stay informed</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Station Selector */}
        <View style={styles.sectionLabel}>
          <Ionicons name="train-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.sectionText}>Station</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stationRow}
        >
          {popularStations.map((station) => (
            <Pressable
              key={station.id}
              onPress={() => setSelectedStation(station.id)}
              style={[
                styles.stationChip,
                selectedStation === station.id && styles.stationChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.stationChipText,
                  selectedStation === station.id && styles.stationChipTextSelected,
                ]}
              >
                {station.name}
              </Text>
              <Text style={styles.stationChipLine}>{station.line}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Report Categories Grid */}
        <View style={styles.sectionLabel}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.sectionText}>Issue Type</Text>
        </View>
        <View style={styles.grid}>
          {categories.map(([key, cat]) => {
            const isSelected = selected === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(isSelected ? null : key)}
                style={[
                  styles.gridItem,
                  isSelected && { borderColor: cat.color, backgroundColor: cat.color + '15' },
                ]}
              >
                {/* Pulse ring on selected */}
                {isSelected && (
                  <View style={[styles.selectedRing, { borderColor: cat.color }]} />
                )}
                <View
                  style={[
                    styles.gridIcon,
                    { backgroundColor: isSelected ? cat.color + '25' : Colors.background },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={isSelected ? cat.color : Colors.textSecondary}
                  />
                </View>
                <Text style={[styles.gridLabel, isSelected && { color: cat.color }]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Points preview */}
        <View style={styles.pointsPreview}>
          <Ionicons name="star" size={14} color={Colors.amber} />
          <Text style={styles.pointsText}>Submit a report to earn +15 Commuter Points</Text>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!selected || submitting}
          style={[
            styles.submitBtn,
            (!selected || submitting) && styles.submitBtnDisabled,
          ]}
        >
          <Ionicons
            name={submitting ? 'hourglass-outline' : 'send-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </Pressable>
      </RNAnimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 34,
    ...Shadow.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  sectionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stationRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stationChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  stationChipSelected: {
    borderColor: Colors.amber,
    backgroundColor: Colors.amberLight,
  },
  stationChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  stationChipTextSelected: {
    color: Colors.amberDark,
  },
  stationChipLine: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gridItem: {
    width: '22%',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    position: 'relative',
  },
  selectedRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: BorderRadius.lg + 2,
    borderWidth: 2,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 11,
  },
  pointsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.amberLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pointsText: {
    fontSize: FontSize.sm,
    color: Colors.amberDark,
    fontWeight: FontWeight.medium,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.amber,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.border,
  },
  submitBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
