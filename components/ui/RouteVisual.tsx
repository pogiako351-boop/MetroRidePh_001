import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { RouteResult } from '@/constants/fares';
import { LINE_COLORS } from '@/constants/stations';

interface RouteVisualProps {
  route: RouteResult;
  showStops?: boolean;
}

export function RouteVisual({ route, showStops = false }: RouteVisualProps) {
  return (
    <View style={styles.container}>
      {route.segments.map((segment, index) => {
        const lineColor = LINE_COLORS[segment.line];
        return (
          <React.Fragment key={`${segment.line}-${index}`}>
            {index > 0 && (
              <View style={styles.transferSection}>
                <View style={styles.transferLine} />
                <View style={styles.transferBadge}>
                  <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
                  <Text style={styles.transferText}>Transfer</Text>
                </View>
                <View style={styles.transferLine} />
              </View>
            )}
            <View style={styles.segment}>
              {/* Start station */}
              <View style={styles.stationRow}>
                <View style={[styles.stationDotLarge, { borderColor: lineColor }]}>
                  <View style={[styles.stationDotInner, { backgroundColor: lineColor }]} />
                </View>
                <View style={styles.stationTextContainer}>
                  <Text style={styles.stationNameMain}>{segment.from}</Text>
                  <Text style={styles.directionText}>{segment.direction}</Text>
                </View>
              </View>

              {/* Line */}
              <View style={styles.lineContainer}>
                <View style={[styles.line, { backgroundColor: lineColor }]} />
                <View style={styles.lineInfo}>
                  <View style={[styles.lineBadge, { backgroundColor: lineColor + '15' }]}>
                    <Text style={[styles.lineName, { color: lineColor }]}>{segment.line}</Text>
                  </View>
                  <Text style={styles.stopsText}>
                    {segment.stations} {segment.stations === 1 ? 'stop' : 'stops'} · {segment.time} min
                  </Text>

                  {showStops && segment.stationNames.length > 2 && (
                    <View style={styles.intermediateStops}>
                      {segment.stationNames.slice(1, -1).map((name, i) => (
                        <View key={i} style={styles.stopRow}>
                          <View style={[styles.stopDot, { backgroundColor: lineColor }]} />
                          <Text style={styles.stopName}>{name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* End station */}
              <View style={styles.stationRow}>
                <View style={[styles.stationDotLarge, { borderColor: lineColor }]}>
                  <View style={[styles.stationDotInner, { backgroundColor: lineColor }]} />
                </View>
                <View style={styles.stationTextContainer}>
                  <Text style={styles.stationNameMain}>{segment.to}</Text>
                  <Text style={styles.fareText}>₱{segment.fare}</Text>
                </View>
              </View>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  segment: {},
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stationDotLarge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stationTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stationNameMain: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  directionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  fareText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  lineContainer: {
    flexDirection: 'row',
    paddingLeft: 9,
    minHeight: 60,
  },
  line: {
    width: 3,
    borderRadius: 1.5,
  },
  lineInfo: {
    paddingLeft: Spacing.xl,
    paddingVertical: Spacing.sm,
    flex: 1,
  },
  lineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  lineName: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  stopsText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  intermediateStops: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  stopName: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  transferSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingLeft: 4,
    gap: Spacing.sm,
  },
  transferLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  transferText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
});
