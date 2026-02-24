import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { ALL_STATIONS, Station, LineId } from '@/constants/stations';
import { LineDot } from './LineDot';

interface StationPickerProps {
  label: string;
  selectedStation: Station | null;
  onSelect: (station: Station) => void;
  filterLine?: LineId;
  excludeStationId?: string;
}

export function StationPicker({
  label,
  selectedStation,
  onSelect,
  filterLine,
  excludeStationId,
}: StationPickerProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filteredStations = useMemo(() => {
    let stations = filterLine
      ? ALL_STATIONS.filter((s) => s.line === filterLine)
      : ALL_STATIONS;

    if (excludeStationId) {
      stations = stations.filter((s) => s.id !== excludeStationId);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      stations = stations.filter(
        (s) => s.name.toLowerCase().includes(q) || s.line.toLowerCase().includes(q)
      );
    }

    return stations;
  }, [search, filterLine, excludeStationId]);

  const handleSelect = useCallback((station: Station) => {
    onSelect(station);
    setVisible(false);
    setSearch('');
  }, [onSelect]);

  const renderStation = useCallback(({ item }: { item: Station }) => (
    <Pressable
      style={({ pressed }) => [styles.stationItem, pressed && styles.stationItemPressed]}
      onPress={() => handleSelect(item)}
    >
      <LineDot line={item.line} size={10} />
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
        <Text style={styles.stationLine}>{item.line}</Text>
      </View>
      {item.isTransfer && (
        <View style={styles.transferBadge}>
          <Ionicons name="swap-horizontal" size={12} color={Colors.primary} />
        </View>
      )}
    </Pressable>
  ), [handleSelect]);

  return (
    <>
      <Pressable
        style={[styles.picker, selectedStation && styles.pickerSelected]}
        onPress={() => setVisible(true)}
      >
        <View style={styles.pickerContent}>
          <Text style={styles.label}>{label}</Text>
          {selectedStation ? (
            <View style={styles.selectedRow}>
              <LineDot line={selectedStation.line} size={8} />
              <Text style={styles.selectedText}>{selectedStation.name}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>Tap to select station</Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => { setVisible(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stations..."
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredStations}
            keyExtractor={(item) => item.id}
            renderItem={renderStation}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pickerSelected: {
    borderColor: Colors.primary,
  },
  pickerContent: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectedText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  placeholder: {
    fontSize: FontSize.lg,
    color: Colors.textTertiary,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  stationItemPressed: {
    backgroundColor: Colors.primarySoft,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  stationLine: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  transferBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.full,
    padding: 4,
  },
});
