import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { CommuterProfile, CommuterLevel } from '@/utils/commuterPoints';

const LEVEL_COLORS: Record<CommuterLevel, { bg: string; text: string; border: string }> = {
  Newbie: { bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0' },
  Regular: { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  Trusted: { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
  Expert: { bg: '#EDE7F6', text: '#4527A0', border: '#B39DDB' },
  Legend: { bg: '#FFF8E1', text: '#E65100', border: '#FFB74D' },
};

interface CommuterBadgeProps {
  profile: CommuterProfile;
  onPress?: () => void;
  compact?: boolean;
}

export function CommuterBadge({ profile, onPress, compact = false }: CommuterBadgeProps) {
  const levelStyle = LEVEL_COLORS[profile.level];

  if (compact) {
    return (
      <Pressable onPress={onPress} style={[styles.compactContainer, { borderColor: levelStyle.border, backgroundColor: levelStyle.bg }]}>
        <Text style={[styles.compactPoints, { color: levelStyle.text }]}>
          ⭐ {profile.points}
        </Text>
        <Text style={[styles.compactLevel, { color: levelStyle.text }]}>
          {profile.level}
        </Text>
      </Pressable>
    );
  }

  const progressPercent = getProgressPercent(profile.points, profile.level);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { borderColor: levelStyle.border, backgroundColor: levelStyle.bg }]}
    >
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <Text style={styles.levelEmoji}>{getLevelEmoji(profile.level)}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.levelText, { color: levelStyle.text }]}>{profile.level}</Text>
            <Text style={[styles.pointsText, { color: levelStyle.text }]}>
              {profile.points} pts
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` as `${number}%`, backgroundColor: levelStyle.text },
              ]}
            />
          </View>
          <Text style={[styles.statsText, { color: levelStyle.text }]}>
            {profile.totalReports} reports · {profile.badges.length} badges
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function getLevelEmoji(level: CommuterLevel): string {
  const emojis: Record<CommuterLevel, string> = {
    Newbie: '🚶',
    Regular: '🚇',
    Trusted: '⭐',
    Expert: '🏆',
    Legend: '👑',
  };
  return emojis[level];
}

function getProgressPercent(points: number, level: CommuterLevel): number {
  const thresholds: Record<CommuterLevel, [number, number]> = {
    Newbie: [0, 50],
    Regular: [50, 150],
    Trusted: [150, 300],
    Expert: [300, 600],
    Legend: [600, 1000],
  };
  const [min, max] = thresholds[level];
  const progress = Math.min(((points - min) / (max - min)) * 100, 100);
  return Math.max(0, progress);
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  pointsText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  statsText: {
    fontSize: FontSize.xs,
    opacity: 0.7,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  compactPoints: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  compactLevel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
