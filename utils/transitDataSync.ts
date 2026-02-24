import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

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
  isLiveData: boolean;
  lastSync: Date | null;
  syncStatus: SyncStatus;
  cloudStations: CloudStation[] | null;
  cloudFareMatrix: CloudFareEntry[] | null;
  triggerSync: () => void;
}

// ── Cache TTL: 15 minutes ──────────────────────────────────────────────────
const SYNC_TTL_MS = 15 * 60 * 1000;

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
  const isMounted = useRef(true);
  const isSyncing = useRef(false);

  // Load cached data on mount (sync-free, instant)
  useEffect(() => {
    let cancelled = false;
    loadCachedData().then(({ stations, fareMatrix, lastSync: cached }) => {
      if (cancelled) return;
      if (stations && fareMatrix) {
        setCloudStations(stations);
        setCloudFareMatrix(fareMatrix);
        setLastSync(cached);
        setIsLiveData(true);
        setSyncStatus('success');
      }
    });
    return () => { cancelled = true; };
  }, []);

  const runSync = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || isSyncing.current) return;
    isSyncing.current = true;

    if (!isMounted.current) return;
    setSyncStatus('syncing');

    try {
      // Parallel fetch — non-blocking, low priority
      const [stationsRes, fareRes] = await Promise.all([
        supabase.from('stations').select('*').order('line').order('line_index'),
        supabase.from('fare_matrix').select('*').order('line').order('from_index'),
      ]);

      if (stationsRes.error || fareRes.error) {
        throw new Error(stationsRes.error?.message ?? fareRes.error?.message);
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
      }
    } catch {
      if (isMounted.current) {
        setSyncStatus('error');
        // Keep existing cached data — offline-first
      }
    } finally {
      isSyncing.current = false;
    }
  }, []);

  // Background sync on mount
  useEffect(() => {
    isMounted.current = true;

    // Check if cache is stale before syncing
    loadCachedData().then(({ lastSync: cached }) => {
      const isStale = !cached || Date.now() - cached.getTime() > SYNC_TTL_MS;
      if (isStale) {
        // Defer slightly so UI renders first (non-blocking)
        const timer = setTimeout(runSync, 2000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [runSync]);

  return {
    isLiveData,
    lastSync,
    syncStatus,
    cloudStations,
    cloudFareMatrix,
    triggerSync: runSync,
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
