import AsyncStorage from '@react-native-async-storage/async-storage';
import { Station, ALL_STATIONS, searchStations } from '@/constants/stations';

const KEYS = {
  STATION_VISITS: '@metroride_station_visits',
};

export interface StationVisit {
  stationId: string;
  count: number;
  lastVisited: number; // timestamp ms
}

/** Record a station visit */
export async function recordStationVisit(stationId: string): Promise<void> {
  try {
    const visits = await getStationVisits();
    const existing = visits.find((v) => v.stationId === stationId);
    if (existing) {
      existing.count += 1;
      existing.lastVisited = Date.now();
    } else {
      visits.push({ stationId, count: 1, lastVisited: Date.now() });
    }
    await AsyncStorage.setItem(KEYS.STATION_VISITS, JSON.stringify(visits));
  } catch {
    // Silent fail
  }
}

/** Get all station visit records */
export async function getStationVisits(): Promise<StationVisit[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.STATION_VISITS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Compute frecency score: combines visit frequency and recency.
 * Higher score = more relevant.
 */
function computeFrecencyScore(visit: StationVisit): number {
  const hoursSinceVisit = (Date.now() - visit.lastVisited) / (1000 * 60 * 60);
  // Recency decay: halves every 24 hours
  const recencyFactor = Math.pow(0.5, hoursSinceVisit / 24);
  return visit.count * recencyFactor * 100;
}

/**
 * Search stations with frecency-based ranking.
 * Frequent/recent stations float to the top.
 */
export async function frecencySearch(query: string): Promise<Station[]> {
  try {
    const visits = await getStationVisits();
    const visitMap = new Map<string, number>();
    visits.forEach((v) => {
      visitMap.set(v.stationId, computeFrecencyScore(v));
    });

    if (query.trim().length === 0) {
      // Return top frecency stations when no query
      const scored = ALL_STATIONS.map((s) => ({
        station: s,
        score: visitMap.get(s.id) ?? 0,
      }));
      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((s) => s.station);
    }

    // Search + boost by frecency
    const results = searchStations(query);
    const scored = results.map((s) => ({
      station: s,
      score: visitMap.get(s.id) ?? 0,
    }));

    // Sort: frecency boosted stations first, then by name
    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.station.name.localeCompare(b.station.name);
      })
      .map((s) => s.station);
  } catch {
    return searchStations(query);
  }
}

/** Get recently visited stations (for quick access) */
export async function getRecentStations(limit = 5): Promise<Station[]> {
  try {
    const visits = await getStationVisits();
    const sorted = visits.sort((a, b) => b.lastVisited - a.lastVisited).slice(0, limit);
    return sorted
      .map((v) => ALL_STATIONS.find((s) => s.id === v.stationId))
      .filter(Boolean) as Station[];
  } catch {
    return [];
  }
}
