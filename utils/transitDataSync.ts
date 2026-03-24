import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { logError } from './errorLogger';

// ── AsyncStorage Keys ──────────────────────────────────────────────────────
const KEYS = {
  CLOUD_STATIONS: '@metroride_cloud_stations',
  CLOUD_FARE_MATRIX: '@metroride_cloud_fare_matrix',
  LAST_SYNC: '@metroride_last_sync',
  SYNC_VERSION: '@metroride_sync_version',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────
export interface CloudStation {
  id: string;
  station_id: string;
  name: string;
  line: string;
  line_index: number;
  latitude: number;
  longitude: number;
  status: string;
  first_train: string;
  last_train: string;
  updated_at: string;
}

export interface CloudFareEntry {
  id: string;
  line: string;
  from_index: number;
  to_index: number;
  base_fare: number;
  version: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface TransitDataSyncState {
  /** True only when the most recent data was fetched live from Supabase */
  isLiveData: boolean;
  lastSync: Date | null;
  syncStatus: SyncStatus;
  cloudStations: CloudStation[] | null;
  cloudFareMatrix: CloudFareEntry[] | null;
  triggerSync: () => void;
  /** Seconds since last successful sync (null if never synced) */
  secondsSinceSync: number | null;
}

// ── Real-time polling interval: 5 minutes ─────────────────────────────────
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// ── Load cached data from AsyncStorage ────────────────────────────────────
async function loadCachedData(): Promise<{
  stations: CloudStation[] | null;
  fareMatrix: CloudFareEntry[] | null;
  lastSync: Date | null;
}> {
  try {
    const [stationsRaw, fareMatrixRaw, lastSyncRaw] = await AsyncStorage.multiGet([
      KEYS.CLOUD_STATIONS,
      KEYS.CLOUD_FARE_MATRIX,
      KEYS.LAST_SYNC,
    ]);

    const stations = stationsRaw[1] ? (JSON.parse(stationsRaw[1]) as CloudStation[]) : null;
    const fareMatrix = fareMatrixRaw[1] ? (JSON.parse(fareMatrixRaw[1]) as CloudFareEntry[]) : null;
    const lastSync = lastSyncRaw[1] ? new Date(lastSyncRaw[1]) : null;

    return { stations, fareMatrix, lastSync };
  } catch {
    return { stations: null, fareMatrix: null, lastSync: null };
  }
}

// ── Persist synced data ────────────────────────────────────────────────────
async function persistSyncedData(
  stations: CloudStation[],
  fareMatrix: CloudFareEntry[],
  syncTime: Date,
): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.CLOUD_STATIONS, JSON.stringify(stations)],
    [KEYS.CLOUD_FARE_MATRIX, JSON.stringify(fareMatrix)],
    [KEYS.LAST_SYNC, syncTime.toISOString()],
  ]);
}

// ── Main Hook ──────────────────────────────────────────────────────────────
export function useTransitDataSync(): TransitDataSyncState {
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [cloudStations, setCloudStations] = useState<CloudStation[] | null>(null);
  const [cloudFareMatrix, setCloudFareMatrix] = useState<CloudFareEntry[] | null>(null);
  const [secondsSinceSync, setSecondsSinceSync] = useState<number | null>(null);
  const isMounted = useRef(true);
  const isSyncing = useRef(false);

  // ── Live seconds-since-sync ticker ────────────────────────────────────────
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsSinceSync(lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 1000) : null);
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastSync]);

  const runSync = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn(
        '[TransitSync] Sync skipped — Supabase not configured.',
        `isConfigured: ${isSupabaseConfigured}, client: ${!!supabase}`,
      );
      if (isMounted.current) {
        setSyncStatus('error');
        setIsLiveData(false);
      }
      return;
    }
    if (isSyncing.current) return;
    isSyncing.current = true;

    if (!isMounted.current) { isSyncing.current = false; return; }
    setSyncStatus('syncing');

    try {
      const syncStart = Date.now();

      // Parallel fetch — non-blocking, low priority
      const [stationsRes, fareRes] = await Promise.all([
        supabase.from('stations').select('*').order('line').order('line_index'),
        supabase.from('fare_matrix').select('*').order('line').order('from_index'),
      ]);

      const syncDuration = Date.now() - syncStart;

      if (stationsRes.error || fareRes.error) {
        const errMsg = stationsRes.error?.message ?? fareRes.error?.message ?? 'Unknown';
        const errCode = stationsRes.error?.code ?? fareRes.error?.code ?? 'N/A';
        console.error(
          `[TransitSync] Supabase query error (${syncDuration}ms):`,
          `Code: ${errCode}`,
          `Message: ${errMsg}`,
          stationsRes.error?.hint ? `Hint: ${stationsRes.error.hint}` : '',
        );
        throw new Error(errMsg);
      }

      const stations = stationsRes.data as CloudStation[];
      const fareMatrix = fareRes.data as CloudFareEntry[];

      if (stations?.length && fareMatrix?.length) {
        const syncTime = new Date();
        await persistSyncedData(stations, fareMatrix, syncTime);

        if (isMounted.current) {
          setCloudStations(stations);
          setCloudFareMatrix(fareMatrix);
          setLastSync(syncTime);
          setIsLiveData(true);
          setSyncStatus('success');
        }
        console.log(
          `[TransitSync] Live sync OK (${syncDuration}ms) — ${stations.length} stations, ${fareMatrix.length} fares`,
        );
      } else {
        // Empty response — treat as error (tables should have data)
        console.error(
          `[TransitSync] Empty response (${syncDuration}ms) — stations: ${stations?.length ?? 0}, fares: ${fareMatrix?.length ?? 0}`,
        );
        throw new Error('Empty response from Supabase — stations or fare_matrix returned no rows');
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        setSyncStatus('error');
        setIsLiveData(false);
        // Keep existing cached data — offline-first
      }

      // Classify the error for browser console
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        console.error(
          '[TransitSync] NETWORK ERROR — possible causes: CORS block, DNS failure, no internet, or stale SW cache.',
          `Origin: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}`,
        );
      } else if (errorMsg.includes('timeout') || errorMsg.includes('AbortError')) {
        console.error('[TransitSync] TIMEOUT — Supabase did not respond in time.');
      }

      // Log sync failure for monitoring
      void logError('sync_error', err, 'Supabase transit data sync failure');
    } finally {
      isSyncing.current = false;
    }
  }, []);

  // Load cached data on mount, then immediately attempt live sync
  useEffect(() => {
    isMounted.current = true;

    loadCachedData().then(({ stations, fareMatrix, lastSync: cached }) => {
      if (!isMounted.current) return;
      if (stations && fareMatrix) {
        setCloudStations(stations);
        setCloudFareMatrix(fareMatrix);
        setLastSync(cached);
        // Mark as offline/cached — NOT live until we verify with Supabase
        setSyncStatus('offline');
        setIsLiveData(false);
      }
      // Always attempt live sync on mount — prioritize live data
      const timer = setTimeout(runSync, 500);
      return () => clearTimeout(timer);
    });

    return () => {
      isMounted.current = false;
    };
  }, [runSync]);

  // ── Real-time polling: refresh every POLL_INTERVAL_MS ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMounted.current) {
        runSync();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [runSync]);

  return {
    isLiveData,
    lastSync,
    syncStatus,
    cloudStations,
    cloudFareMatrix,
    triggerSync: runSync,
    secondsSinceSync,
  };
}

// ── Singleton sync state for cross-component access ───────────────────────
let _globalSyncState: TransitDataSyncState | null = null;
export function setGlobalSyncState(state: TransitDataSyncState) {
  _globalSyncState = state;
}
export function getGlobalSyncState(): TransitDataSyncState | null {
  return _globalSyncState;
}
