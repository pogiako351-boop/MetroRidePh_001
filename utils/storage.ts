import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_STATIONS, Station } from '@/constants/stations';
import { FARE_TABLES } from '@/constants/fares';
import { supabase, isSupabaseConfigured } from './supabase';
import { enqueueOperation } from './offlineSyncQueue';

const KEYS = {
  FAVORITES_STATIONS: '@metroride_fav_stations',
  FAVORITES_ROUTES: '@metroride_fav_routes',
  OFFLINE_STATIONS: '@metroride_offline_stations',
  OFFLINE_FARES: '@metroride_offline_fares',
  LAST_SYNC: '@metroride_last_sync',
  CROWD_LEVELS: '@metroride_crowd_levels',
  ALERTS: '@metroride_alerts',
};

export interface FavoriteStation {
  stationId: string;
  label: 'home' | 'work' | 'custom';
  customLabel?: string;
  addedAt: string;
}

export interface FavoriteRoute {
  id: string;
  fromStationId: string;
  toStationId: string;
  label: 'home' | 'work' | 'custom';
  customLabel?: string;
  addedAt: string;
}

export interface CrowdLevel {
  stationId: string;
  level: 'light' | 'moderate' | 'heavy';
  updatedAt: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  line: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  expiresAt?: string;
}

// Favorites
export async function getFavoriteStations(): Promise<FavoriteStation[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.FAVORITES_STATIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteStation(fav: FavoriteStation): Promise<void> {
  const existing = await getFavoriteStations();
  const filtered = existing.filter((f) => f.stationId !== fav.stationId);
  filtered.push(fav);
  await AsyncStorage.setItem(KEYS.FAVORITES_STATIONS, JSON.stringify(filtered));
}

export async function removeFavoriteStation(stationId: string): Promise<void> {
  const existing = await getFavoriteStations();
  const filtered = existing.filter((f) => f.stationId !== stationId);
  await AsyncStorage.setItem(KEYS.FAVORITES_STATIONS, JSON.stringify(filtered));
}

export async function isFavoriteStation(stationId: string): Promise<boolean> {
  const favs = await getFavoriteStations();
  return favs.some((f) => f.stationId === stationId);
}

// Favorite Routes
export async function getFavoriteRoutes(): Promise<FavoriteRoute[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.FAVORITES_ROUTES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteRoute(route: FavoriteRoute): Promise<void> {
  const existing = await getFavoriteRoutes();
  const filtered = existing.filter((r) => r.id !== route.id);
  filtered.push(route);
  await AsyncStorage.setItem(KEYS.FAVORITES_ROUTES, JSON.stringify(filtered));
}

export async function removeFavoriteRoute(routeId: string): Promise<void> {
  const existing = await getFavoriteRoutes();
  const filtered = existing.filter((r) => r.id !== routeId);
  await AsyncStorage.setItem(KEYS.FAVORITES_ROUTES, JSON.stringify(filtered));
}

// Offline Data
export async function syncOfflineData(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.OFFLINE_STATIONS, JSON.stringify(ALL_STATIONS));
    await AsyncStorage.setItem(KEYS.OFFLINE_FARES, JSON.stringify(FARE_TABLES));
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch {
    // Silent fail for offline sync
  }
}

export async function getOfflineStations(): Promise<Station[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.OFFLINE_STATIONS);
    return data ? JSON.parse(data) : ALL_STATIONS;
  } catch {
    return ALL_STATIONS;
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

// Crowd Levels
export async function getCrowdLevels(): Promise<CrowdLevel[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CROWD_LEVELS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCrowdLevels(levels: CrowdLevel[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CROWD_LEVELS, JSON.stringify(levels));
}

/**
 * User-initiated crowd-level update (e.g. from a station detail screen).
 * Saves locally immediately (optimistic), then queues a cloud sync so
 * the update reaches Supabase as soon as connectivity returns.
 */
export async function submitCrowdLevelUpdate(level: CrowdLevel): Promise<void> {
  try {
    // Optimistic local update
    const current = await getCrowdLevels();
    const updated = current.filter((l) => l.stationId !== level.stationId);
    updated.push(level);
    await AsyncStorage.setItem(KEYS.CROWD_LEVELS, JSON.stringify(updated));

    // Queue cloud sync — flushed automatically when online
    await enqueueOperation('update_crowd_level', {
      stationId: level.stationId,
      level:     level.level,
      updatedAt: level.updatedAt,
    } as Record<string, unknown>);
  } catch {
    // Silent — local save is the source of truth
  }
}

/**
 * Processes a queued 'update_crowd_level' operation.
 * Called by the background sync queue flush handler.
 * Returns true on success, false to reschedule.
 */
export async function handleQueuedCrowdLevel(
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from('crowd_levels').upsert(
      {
        station_id: payload.stationId,
        level:      payload.level,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'station_id' },
    );
    return !error;
  } catch {
    return false;
  }
}

// Alerts
export async function getAlerts(): Promise<Alert[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.ALERTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveAlerts(alerts: Alert[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALERTS, JSON.stringify(alerts));
}
