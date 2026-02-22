import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  TextInput,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import {
  Station,
  LineId,
  LINE_COLORS,
  LINE_NAMES,
  MRT3_STATIONS,
  LRT1_STATIONS,
  LRT2_STATIONS,
} from '@/constants/stations';
import { Badge } from '@/components/ui/Badge';
import { LineDot } from '@/components/ui/LineDot';

type FilterLine = 'all' | LineId;

const LINE_FILTERS: { key: FilterLine; label: string }[] = [
  { key: 'all', label: 'All Lines' },
  { key: 'MRT-3', label: 'MRT-3' },
  { key: 'LRT-1', label: 'LRT-1' },
  { key: 'LRT-2', label: 'LRT-2' },
];

export default function StationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterLine>('all');

  const sections = useMemo(() => {
    const allSections: { title: string; line: LineId; data: Station[] }[] = [];

    const addSection = (line: LineId, stations: Station[]) => {
      if (activeFilter !== 'all' && activeFilter !== line) return;
      let filtered = stations;
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = stations.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.nearbyStreets.some((st) => st.toLowerCase().includes(q))
        );
      }
      if (filtered.length > 0) {
        allSections.push({
          title: LINE_NAMES[line],
          line,
          data: filtered,
        });
      }
    };

    addSection('MRT-3', MRT3_STATIONS);
    addSection('LRT-1', LRT1_STATIONS);
    addSection('LRT-2', LRT2_STATIONS);

    return allSections;
  }, [search, activeFilter]);

  const renderStationCard = useCallback(
    ({ item, index }: { item: Station; index: number }) => (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 30)}>
        <Pressable
          style={({ pressed }) => [styles.stationCard, pressed && styles.stationCardPressed]}
          onPress={() => router.push(`/station/${item.id}`)}
        >
          <View style={[styles.lineStrip, { backgroundColor: LINE_COLORS[item.line] }]} />
          <View style={styles.stationContent}>
            <View style={styles.stationTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stationName}>{item.name}</Text>
                <View style={styles.stationMeta}>
                  <Ionicons name="layers-outline" size={12} color={Colors.textTertiary} />
                  <Text style={styles.stationMetaText}>
                    {item.platforms} {item.platforms === 1 ? 'platform' : 'platforms'}
                  </Text>
                  {item.isTransfer && (
                    <>
                      <Text style={styles.stationMetaDot}>·</Text>
                      <Ionicons name="swap-horizontal" size={12} color={Colors.primary} />
                      <Text style={[styles.stationMetaText, { color: Colors.primary }]}>
                        Transfer
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <Badge
                text={item.status}
                variant={item.status === 'Normal' ? 'success' : item.status === 'Delayed' ? 'warning' : 'error'}
                small
              />
            </View>
            <View style={styles.stationBottom}>
              <View style={styles.stationTime}>
                <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.stationTimeText}>
                  {item.firstTrain} - {item.lastTrain}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    ),
    [router]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; line: LineId } }) => (
      <View style={styles.sectionHeader}>
        <LineDot line={section.line} size={14} />
        <Text style={[styles.sectionTitle, { color: LINE_COLORS[section.line] }]}>
          {section.title}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: LINE_COLORS[section.line] + '30' }]} />
      </View>
    ),
    []
  );

  const totalStations = sections.reduce((sum, s) => sum + s.data.length, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Station Directory</Text>
        <Text style={styles.headerSubtitle}>{totalStations} stations across 3 lines</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stations..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {LINE_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          const color = filter.key === 'all' ? Colors.primary : LINE_COLORS[filter.key as LineId];
          return (
            <Pressable
              key={filter.key}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  isActive && { color: '#FFFFFF' },
                  !isActive && filter.key !== 'all' && { color },
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Station List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderStationCard}
        renderSectionHeader={renderSectionHeader as any}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="train-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No stations found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  stationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  stationCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  lineStrip: {
    width: 4,
  },
  stationContent: {
    flex: 1,
    padding: Spacing.md,
  },
  stationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stationName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stationMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  stationMetaDot: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
  },
  stationBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  stationTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stationTimeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
});
