import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReportCategory =
  | 'long_lines'
  | 'broken_elevator'
  | 'aircon_issue'
  | 'technical_delay'
  | 'overcrowding'
  | 'security_concern'
  | 'cleanliness'
  | 'fare_machine';

export interface CommunityReport {
  id: string;
  category: ReportCategory;
  stationId: string;
  stationName: string;
  line: string;
  description?: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: number;
  expiresAt: number;
  reporterId: string;
}

export const REPORT_CATEGORIES: Record<
  ReportCategory,
  { label: string; icon: string; color: string }
> = {
  long_lines: { label: 'Long Lines', icon: 'people-outline', color: '#F59E0B' },
  broken_elevator: { label: 'Broken Elevator', icon: 'arrow-up-outline', color: '#EA4335' },
  aircon_issue: { label: 'Aircon Issue', icon: 'snow-outline', color: '#4285F4' },
  technical_delay: { label: 'Technical Delay', icon: 'alert-circle-outline', color: '#EA4335' },
  overcrowding: { label: 'Overcrowding', icon: 'body-outline', color: '#F59E0B' },
  security_concern: { label: 'Security Issue', icon: 'shield-outline', color: '#9C27B0' },
  cleanliness: { label: 'Cleanliness', icon: 'trash-outline', color: '#5F6368' },
  fare_machine: { label: 'Fare Machine', icon: 'card-outline', color: '#1A73E8' },
};

const REPORTS_KEY = '@metroride_community_reports';
const USER_ID_KEY = '@metroride_user_id';

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 11);
}

export async function getUserId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
    const newId = generateUserId();
    await AsyncStorage.setItem(USER_ID_KEY, newId);
    return newId;
  } catch {
    return generateUserId();
  }
}

export async function getCommunityReports(): Promise<CommunityReport[]> {
  try {
    const data = await AsyncStorage.getItem(REPORTS_KEY);
    if (!data) return getDefaultReports();
    const reports: CommunityReport[] = JSON.parse(data);
    const now = Date.now();
    return reports.filter((r) => r.expiresAt > now);
  } catch {
    return getDefaultReports();
  }
}

export async function saveCommunityReport(
  category: ReportCategory,
  stationId: string,
  stationName: string,
  line: string
): Promise<CommunityReport> {
  const userId = await getUserId();
  const now = Date.now();
  const report: CommunityReport = {
    id: 'report_' + now + '_' + Math.random().toString(36).substring(2, 7),
    category,
    stationId,
    stationName,
    line,
    upvotes: 1,
    upvotedBy: [userId],
    createdAt: now,
    expiresAt: now + 2 * 60 * 60 * 1000, // 2 hours
    reporterId: userId,
  };

  const existing = await getCommunityReports();
  const updated = [report, ...existing].slice(0, 50);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  return report;
}

export async function upvoteReport(reportId: string): Promise<void> {
  const userId = await getUserId();
  const reports = await getCommunityReports();
  const updated = reports.map((r) => {
    if (r.id === reportId && !r.upvotedBy.includes(userId)) {
      return { ...r, upvotes: r.upvotes + 1, upvotedBy: [...r.upvotedBy, userId] };
    }
    return r;
  });
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
}

export async function hasUserUpvoted(reportId: string): Promise<boolean> {
  const userId = await getUserId();
  const reports = await getCommunityReports();
  const report = reports.find((r) => r.id === reportId);
  return report ? report.upvotedBy.includes(userId) : false;
}

function getDefaultReports(): CommunityReport[] {
  const now = Date.now();
  return [
    {
      id: 'default_1',
      category: 'long_lines',
      stationId: 'mrt3-ayala',
      stationName: 'Ayala',
      line: 'MRT-3',
      upvotes: 14,
      upvotedBy: [],
      createdAt: now - 15 * 60 * 1000,
      expiresAt: now + 90 * 60 * 1000,
      reporterId: 'sys',
    },
    {
      id: 'default_2',
      category: 'technical_delay',
      stationId: 'mrt3-cubao',
      stationName: 'Araneta Center-Cubao',
      line: 'MRT-3',
      upvotes: 8,
      upvotedBy: [],
      createdAt: now - 30 * 60 * 1000,
      expiresAt: now + 60 * 60 * 1000,
      reporterId: 'sys',
    },
    {
      id: 'default_3',
      category: 'overcrowding',
      stationId: 'lrt1-doroteo-jose',
      stationName: 'Doroteo Jose',
      line: 'LRT-1',
      upvotes: 22,
      upvotedBy: [],
      createdAt: now - 10 * 60 * 1000,
      expiresAt: now + 110 * 60 * 1000,
      reporterId: 'sys',
    },
  ];
}
