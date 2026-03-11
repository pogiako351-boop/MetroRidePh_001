import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

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

// Netlify function base URL — works on web production; empty on native
function getNetlifyBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return '/.netlify/functions';
  }
  return '';
}

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

// ── Local cache helpers ────────────────────────────────────────────────────

async function getLocalReports(): Promise<CommunityReport[]> {
  try {
    const data = await AsyncStorage.getItem(REPORTS_KEY);
    if (!data) return [];
    const reports: CommunityReport[] = JSON.parse(data);
    const now = Date.now();
    return reports.filter((r) => r.expiresAt > now);
  } catch {
    return [];
  }
}

async function saveLocalReports(reports: CommunityReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(0, 50)));
  } catch {
    // Silent failure
  }
}

// ── Cloud fetch via Netlify function ──────────────────────────────────────

async function fetchCloudReports(): Promise<CommunityReport[]> {
  const base = getNetlifyBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/communityReports`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.reports ?? []) as CommunityReport[];
  } catch {
    return [];
  }
}

// ── Cloud write via Netlify function OR Supabase direct ───────────────────

async function pushReportToCloud(report: CommunityReport): Promise<void> {
  const base = getNetlifyBase();

  // On web: use Netlify function
  if (base) {
    try {
      await fetch(`${base}/communityReports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          category: report.category,
          stationId: report.stationId,
          stationName: report.stationName,
          line: report.line,
          description: report.description,
          reporterId: report.reporterId,
          createdAt: report.createdAt,
          expiresAt: report.expiresAt,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Silent — already saved locally
    }
    return;
  }

  // On native: use Supabase client directly
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('community_reports').insert([{
        id: report.id,
        category: report.category,
        station_id: report.stationId,
        station_name: report.stationName,
        line: report.line,
        description: report.description ?? null,
        upvotes: 1,
        upvoted_by: [report.reporterId],
        created_at: new Date(report.createdAt).toISOString(),
        expires_at: new Date(report.expiresAt).toISOString(),
        reporter_id: report.reporterId,
      }]);
    } catch {
      // Silent — already saved locally
    }
  }
}

async function pushUpvoteToCloud(reportId: string, userId: string): Promise<void> {
  const base = getNetlifyBase();

  if (base) {
    try {
      await fetch(`${base}/communityReports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote', reportId, userId }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Silent
    }
    return;
  }

  // Native fallback via Supabase client
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: current } = await supabase
        .from('community_reports')
        .select('upvotes, upvoted_by')
        .eq('id', reportId)
        .single();

      if (current && !current.upvoted_by.includes(userId)) {
        await supabase
          .from('community_reports')
          .update({
            upvotes: current.upvotes + 1,
            upvoted_by: [...current.upvoted_by, userId],
          })
          .eq('id', reportId);
      }
    } catch {
      // Silent
    }
  }
}

// ── Merge cloud + local, deduplicate by id ────────────────────────────────

function mergeReports(cloud: CommunityReport[], local: CommunityReport[]): CommunityReport[] {
  const map = new Map<string, CommunityReport>();
  // Cloud data takes precedence for existing ids (more upvotes etc.)
  for (const r of local) map.set(r.id, r);
  for (const r of cloud) map.set(r.id, r);
  const now = Date.now();
  return Array.from(map.values())
    .filter((r) => r.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getCommunityReports(): Promise<CommunityReport[]> {
  const [local, cloud] = await Promise.all([getLocalReports(), fetchCloudReports()]);

  if (cloud.length === 0 && local.length === 0) {
    return getDefaultReports();
  }

  const merged = mergeReports(cloud, local);
  // Persist merged result back to local cache
  if (cloud.length > 0) {
    void saveLocalReports(merged);
  }
  return merged;
}

export async function saveCommunityReport(
  category: ReportCategory,
  stationId: string,
  stationName: string,
  line: string,
  description?: string
): Promise<CommunityReport> {
  const userId = await getUserId();
  const now = Date.now();
  const report: CommunityReport = {
    id: 'report_' + now + '_' + Math.random().toString(36).substring(2, 7),
    category,
    stationId,
    stationName,
    line,
    description,
    upvotes: 1,
    upvotedBy: [userId],
    createdAt: now,
    expiresAt: now + 2 * 60 * 60 * 1000, // 2 hours
    reporterId: userId,
  };

  // Optimistic local save first (instant UX)
  const existing = await getLocalReports();
  const updated = [report, ...existing].slice(0, 50);
  await saveLocalReports(updated);

  // Background cloud push (non-blocking)
  void pushReportToCloud(report);

  return report;
}

export async function upvoteReport(reportId: string): Promise<void> {
  const userId = await getUserId();

  // Optimistic local update
  const reports = await getLocalReports();
  const updated = reports.map((r) => {
    if (r.id === reportId && !r.upvotedBy.includes(userId)) {
      return { ...r, upvotes: r.upvotes + 1, upvotedBy: [...r.upvotedBy, userId] };
    }
    return r;
  });
  await saveLocalReports(updated);

  // Background cloud sync
  void pushUpvoteToCloud(reportId, userId);
}

export async function hasUserUpvoted(reportId: string): Promise<boolean> {
  const userId = await getUserId();
  const reports = await getLocalReports();
  const report = reports.find((r) => r.id === reportId);
  if (report) return report.upvotedBy.includes(userId);
  // Check cloud if not in local
  const cloud = await fetchCloudReports();
  const cloudReport = cloud.find((r) => r.id === reportId);
  return cloudReport ? cloudReport.upvotedBy.includes(userId) : false;
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
