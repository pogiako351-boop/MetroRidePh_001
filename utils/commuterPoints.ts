import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CommuterProfile {
  points: number;
  totalReports: number;
  totalUpvotesGiven: number;
  badges: BadgeId[];
  level: CommuterLevel;
}

export type BadgeId =
  | 'first_report'
  | 'helpful_commuter'
  | 'frequent_reporter'
  | 'top_contributor'
  | 'early_bird'
  | 'night_owl';

export type CommuterLevel = 'Newbie' | 'Regular' | 'Trusted' | 'Expert' | 'Legend';

export const BADGES: Record<BadgeId, { label: string; icon: string; color: string; points: number }> = {
  first_report: { label: 'First Report', icon: '🏆', color: '#F59E0B', points: 10 },
  helpful_commuter: { label: 'Helpful Commuter', icon: '🤝', color: '#34A853', points: 5 },
  frequent_reporter: { label: 'Frequent Reporter', icon: '📡', color: '#1A73E8', points: 20 },
  top_contributor: { label: 'Top Contributor', icon: '⭐', color: '#8B5CF6', points: 50 },
  early_bird: { label: 'Early Bird', icon: '🌅', color: '#F59E0B', points: 15 },
  night_owl: { label: 'Night Owl', icon: '🦉', color: '#4A90D9', points: 15 },
};

const LEVELS: { level: CommuterLevel; minPoints: number }[] = [
  { level: 'Newbie', minPoints: 0 },
  { level: 'Regular', minPoints: 50 },
  { level: 'Trusted', minPoints: 150 },
  { level: 'Expert', minPoints: 300 },
  { level: 'Legend', minPoints: 600 },
];

function calculateLevel(points: number): CommuterLevel {
  const sorted = [...LEVELS].sort((a, b) => b.minPoints - a.minPoints);
  return (sorted.find((l) => points >= l.minPoints) ?? LEVELS[0]).level;
}

const PROFILE_KEY = '@metroride_commuter_profile';

export async function getCommuterProfile(): Promise<CommuterProfile> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    if (!data) return getDefaultProfile();
    const profile: CommuterProfile = JSON.parse(data);
    return { ...profile, level: calculateLevel(profile.points) };
  } catch {
    return getDefaultProfile();
  }
}

export async function addPoints(amount: number, reason?: string): Promise<CommuterProfile> {
  const profile = await getCommuterProfile();
  const updated: CommuterProfile = {
    ...profile,
    points: profile.points + amount,
    totalReports: reason === 'report' ? profile.totalReports + 1 : profile.totalReports,
    totalUpvotesGiven:
      reason === 'upvote' ? profile.totalUpvotesGiven + 1 : profile.totalUpvotesGiven,
  };

  // Check for new badges
  const newBadges = [...updated.badges];
  if (updated.totalReports === 1 && !newBadges.includes('first_report')) {
    newBadges.push('first_report');
    updated.points += BADGES.first_report.points;
  }
  if (updated.totalReports >= 5 && !newBadges.includes('frequent_reporter')) {
    newBadges.push('frequent_reporter');
    updated.points += BADGES.frequent_reporter.points;
  }
  if (updated.totalUpvotesGiven >= 3 && !newBadges.includes('helpful_commuter')) {
    newBadges.push('helpful_commuter');
    updated.points += BADGES.helpful_commuter.points;
  }

  const hour = new Date().getHours();
  if (hour < 8 && !newBadges.includes('early_bird')) {
    newBadges.push('early_bird');
    updated.points += BADGES.early_bird.points;
  }
  if (hour >= 21 && !newBadges.includes('night_owl')) {
    newBadges.push('night_owl');
    updated.points += BADGES.night_owl.points;
  }

  updated.badges = newBadges;
  updated.level = calculateLevel(updated.points);

  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

export function getNextLevelInfo(points: number): { nextLevel: CommuterLevel; pointsNeeded: number } | null {
  const sorted = [...LEVELS].sort((a, b) => a.minPoints - b.minPoints);
  const next = sorted.find((l) => l.minPoints > points);
  if (!next) return null;
  return { nextLevel: next.level, pointsNeeded: next.minPoints - points };
}

function getDefaultProfile(): CommuterProfile {
  return {
    points: 25,
    totalReports: 0,
    totalUpvotesGiven: 0,
    badges: [],
    level: 'Newbie',
  };
}
