import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Line,
  Circle,
  Rect,
  Text as SvgText,
  G,
  Path,
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';
import { ALL_STATIONS, Station } from '@/constants/stations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAP_WIDTH = 700;
const MAP_HEIGHT = 780;

// Coordinate transform: lat/lon → pixel
function toMapCoords(lat: number, lon: number): { x: number; y: number } {
  const x = (lon - 120.97) * 4125 + 20;
  const y = (14.67 - lat) * 5000 + 20;
  return { x: Math.round(x), y: Math.round(y) };
}

// Precompute station positions
const STATION_POSITIONS = ALL_STATIONS.reduce<Record<string, { x: number; y: number }>>(
  (acc, s) => {
    acc[s.id] = toMapCoords(s.latitude, s.longitude);
    return acc;
  },
  {}
);

const LINE_STROKE = 5;
const STATION_RADIUS = 7;
const TRANSFER_RADIUS = 10;

type LineId = 'MRT-3' | 'LRT-1' | 'LRT-2';
const LINE_COLORS: Record<LineId, string> = {
  'MRT-3': '#1A73E8',
  'LRT-1': '#34A853',
  'LRT-2': '#9C27B0',
};

const ACTIVE_ROUTE_KEY = '@metroride_active_map_route';

export default function TransitMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeRouteStationIds, setActiveRouteStationIds] = useState<string[]>([]);
  const [legendVisible, setLegendVisible] = useState(true);

  // Gesture values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Load active route if any
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_ROUTE_KEY)
      .then((data) => {
        if (data) setActiveRouteStationIds(JSON.parse(data));
      })
      .catch(() => {});
  }, []);

  // Center map on load
  useEffect(() => {
    const offsetX = (SCREEN_WIDTH - MAP_WIDTH * 0.55) / 2;
    const offsetY = 80;
    translateX.value = offsetX;
    translateY.value = offsetY;
    savedTranslateX.value = offsetX;
    savedTranslateY.value = offsetY;
    scale.value = 0.55;
    savedScale.value = 0.55;
  }, [translateX, translateY, savedTranslateX, savedTranslateY, scale, savedScale]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.max(0.3, Math.min(3.5, savedScale.value * e.scale));
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const resetView = useCallback(() => {
    const offsetX = (SCREEN_WIDTH - MAP_WIDTH * 0.55) / 2;
    const offsetY = 80;
    scale.value = withSpring(0.55, { damping: 15 });
    translateX.value = withSpring(offsetX, { damping: 15 });
    translateY.value = withSpring(offsetY, { damping: 15 });
    savedScale.value = 0.55;
    savedTranslateX.value = offsetX;
    savedTranslateY.value = offsetY;
  }, [scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY]);

  const handleStationPress = useCallback(
    (station: Station) => {
      setSelectedStation(station);
    },
    []
  );

  const navigateToStation = useCallback(() => {
    if (!selectedStation) return;
    router.push(`/station/${selectedStation.id}`);
    setSelectedStation(null);
  }, [selectedStation, router]);

  // Group stations by line
  const mrt3Stations = ALL_STATIONS.filter((s) => s.line === 'MRT-3').sort(
    (a, b) => a.lineIndex - b.lineIndex
  );
  const lrt1Stations = ALL_STATIONS.filter((s) => s.line === 'LRT-1').sort(
    (a, b) => a.lineIndex - b.lineIndex
  );
  const lrt2Stations = ALL_STATIONS.filter((s) => s.line === 'LRT-2').sort(
    (a, b) => a.lineIndex - b.lineIndex
  );

  const isActiveRoute = (stationId: string) =>
    activeRouteStationIds.includes(stationId);

  const renderLinePath = (stations: Station[], color: string) => {
    const points = stations
      .map((s) => STATION_POSITIONS[s.id])
      .filter(Boolean);
    if (points.length < 2) return null;

    const pathData = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    return (
      <>
        {/* Shadow line */}
        <Path
          d={pathData}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={LINE_STROKE + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Main line */}
        <Path
          d={pathData}
          stroke={color}
          strokeWidth={LINE_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    );
  };

  const renderStations = (stations: Station[], color: string) =>
    stations.map((station) => {
      const pos = STATION_POSITIONS[station.id];
      if (!pos) return null;
      const r = station.isTransfer ? TRANSFER_RADIUS : STATION_RADIUS;
      const isSelected = selectedStation?.id === station.id;
      const isActive = isActiveRoute(station.id);

      return (
        <G key={station.id}>
          {/* Active route highlight ring */}
          {isActive && (
            <Circle
              cx={pos.x}
              cy={pos.y}
              r={r + 6}
              fill={color + '30'}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
          {/* Selection ring */}
          {isSelected && (
            <Circle
              cx={pos.x}
              cy={pos.y}
              r={r + 8}
              fill="none"
              stroke={Colors.amber}
              strokeWidth={2.5}
            />
          )}
          {/* Station dot */}
          <Circle
            cx={pos.x}
            cy={pos.y}
            r={r}
            fill={isSelected ? Colors.amber : '#FFFFFF'}
            stroke={isActive ? Colors.amber : color}
            strokeWidth={isActive ? 3 : 2.5}
            onPress={() => handleStationPress(station)}
          />
          {/* Transfer inner dot */}
          {station.isTransfer && !isSelected && (
            <Circle cx={pos.x} cy={pos.y} r={r - 4} fill={color} />
          )}
          {/* Station label for important stations */}
          {(station.isTransfer || isSelected || isActive) && (
            <SvgText
              x={pos.x + r + 5}
              y={pos.y + 4}
              fontSize={9}
              fontWeight={isSelected ? 'bold' : '500'}
              fill={isSelected ? Colors.amber : Colors.text}
            >
              {station.name.length > 14
                ? station.name.substring(0, 12) + '…'
                : station.name}
            </SvgText>
          )}
        </G>
      );
    });

  // Transfer connections (dashed lines)
  const renderTransferLines = () => {
    const transfers = [
      // Doroteo Jose ↔ Recto
      { from: 'lrt1-doroteo-jose', to: 'lrt2-recto' },
      // EDSA ↔ Taft Avenue MRT
      { from: 'lrt1-edsa', to: 'mrt3-taft-avenue' },
    ];

    return transfers.map(({ from, to }) => {
      const p1 = STATION_POSITIONS[from];
      const p2 = STATION_POSITIONS[to];
      if (!p1 || !p2) return null;
      return (
        <Line
          key={`${from}-${to}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={Colors.textSecondary}
          strokeWidth={2}
          strokeDasharray="5 4"
          opacity={0.6}
        />
      );
    });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>System Map</Text>
            <Text style={styles.headerSub}>Pinch to zoom · Tap stations</Text>
          </View>
          <Pressable onPress={resetView} style={styles.resetBtn}>
            <Ionicons name="locate-outline" size={20} color={Colors.primary} />
          </Pressable>
        </View>

        {/* Map Area */}
        <View style={styles.mapContainer}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.mapWrapper, animatedStyle]}>
              <Svg
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              >
                {/* Background */}
                <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F0F4FF" rx={12} />

                {/* Grid lines for aesthetics */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <Line
                    key={`hgrid-${i}`}
                    x1={0}
                    y1={i * 80}
                    x2={MAP_WIDTH}
                    y2={i * 80}
                    stroke="#E0E8FF"
                    strokeWidth={0.5}
                  />
                ))}
                {Array.from({ length: 9 }).map((_, i) => (
                  <Line
                    key={`vgrid-${i}`}
                    x1={i * 80}
                    y1={0}
                    x2={i * 80}
                    y2={MAP_HEIGHT}
                    stroke="#E0E8FF"
                    strokeWidth={0.5}
                  />
                ))}

                {/* Lines */}
                {renderLinePath(lrt1Stations, LINE_COLORS['LRT-1'])}
                {renderLinePath(mrt3Stations, LINE_COLORS['MRT-3'])}
                {renderLinePath(lrt2Stations, LINE_COLORS['LRT-2'])}

                {/* Transfer connectors */}
                {renderTransferLines()}

                {/* Stations */}
                {renderStations(lrt1Stations, LINE_COLORS['LRT-1'])}
                {renderStations(mrt3Stations, LINE_COLORS['MRT-3'])}
                {renderStations(lrt2Stations, LINE_COLORS['LRT-2'])}

                {/* Line labels */}
                <Rect x={10} y={MAP_HEIGHT - 35} width={80} height={22} rx={6} fill={LINE_COLORS['LRT-1'] + 'CC'} />
                <SvgText x={50} y={MAP_HEIGHT - 20} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#FFF">LRT Line 1</SvgText>

                <Rect x={310} y={30} width={80} height={22} rx={6} fill={LINE_COLORS['MRT-3'] + 'CC'} />
                <SvgText x={350} y={45} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#FFF">MRT Line 3</SvgText>

                <Rect x={520} y={190} width={80} height={22} rx={6} fill={LINE_COLORS['LRT-2'] + 'CC'} />
                <SvgText x={560} y={205} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#FFF">LRT Line 2</SvgText>
              </Svg>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Legend Toggle */}
        <Pressable
          style={styles.legendToggle}
          onPress={() => setLegendVisible((v) => !v)}
        >
          <Ionicons name={legendVisible ? 'information-circle' : 'information-circle-outline'} size={20} color={Colors.primary} />
        </Pressable>

        {/* Legend */}
        {legendVisible && (
          <View style={styles.legend}>
            {(['MRT-3', 'LRT-1', 'LRT-2'] as LineId[]).map((line) => (
              <View key={line} style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: LINE_COLORS[line] }]} />
                <Text style={styles.legendText}>{line}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={styles.legendTransfer}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              </View>
              <Text style={styles.legendText}>Transfer</Text>
            </View>
          </View>
        )}

        {/* Station Info Card */}
        {selectedStation && (
          <View style={styles.stationCard}>
            <View style={styles.stationCardRow}>
              <View
                style={[
                  styles.stationColorDot,
                  { backgroundColor: LINE_COLORS[selectedStation.line as LineId] },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.stationCardName}>{selectedStation.name}</Text>
                <Text style={styles.stationCardLine}>{selectedStation.line}</Text>
              </View>
              {selectedStation.isTransfer && (
                <View style={styles.transferBadge}>
                  <Ionicons name="swap-horizontal" size={12} color={Colors.amber} />
                  <Text style={styles.transferBadgeText}>Transfer</Text>
                </View>
              )}
              <Pressable
                onPress={() => setSelectedStation(null)}
                style={styles.cardCloseBtn}
              >
                <Ionicons name="close" size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {selectedStation.isTransfer && selectedStation.transferTo && (
              <Text style={styles.transferTo}>
                Connects to: {selectedStation.transferTo.join(', ')}
              </Text>
            )}
            <View style={styles.stationCardActions}>
              <View style={styles.stationMeta}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.stationMetaText}>
                  {selectedStation.firstTrain} – {selectedStation.lastTrain}
                </Text>
              </View>
              <Pressable onPress={navigateToStation} style={styles.viewDetailsBtn}>
                <Text style={styles.viewDetailsBtnText}>View Details</Text>
                <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Zoom hints */}
        <View style={styles.zoomHints}>
          <Pressable
            style={styles.zoomBtn}
            onPress={() => {
              const newScale = Math.min(3.5, savedScale.value * 1.3);
              scale.value = withSpring(newScale);
              savedScale.value = newScale;
            }}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </Pressable>
          <Pressable
            style={styles.zoomBtn}
            onPress={() => {
              const newScale = Math.max(0.3, savedScale.value / 1.3);
              scale.value = withSpring(newScale);
              savedScale.value = newScale;
            }}
          >
            <Ionicons name="remove" size={20} color={Colors.text} />
          </Pressable>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  resetBtn: {
    marginLeft: 'auto',
    padding: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.full,
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EEF2FF',
  },
  mapWrapper: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  legend: {
    position: 'absolute',
    top: 80,
    left: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  legendToggle: {
    position: 'absolute',
    top: 76,
    left: Spacing.lg,
    padding: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendLine: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  legendTransfer: {
    flexDirection: 'row',
    gap: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  stationCard: {
    position: 'absolute',
    bottom: 30,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stationCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stationColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stationCardName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  stationCardLine: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  transferBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.amberDark,
    fontWeight: FontWeight.semibold,
  },
  cardCloseBtn: {
    padding: 4,
  },
  transferTo: {
    fontSize: FontSize.sm,
    color: Colors.violet,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  stationCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stationMetaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  viewDetailsBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  zoomHints: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 30,
    gap: Spacing.sm,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
});
