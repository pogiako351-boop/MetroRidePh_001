import { LineId } from './stations';

// MRT-3 Fare Matrix (PHP) - based on number of stations traveled
export const MRT3_FARES: number[] = [0, 13, 16, 16, 20, 20, 24, 24, 24, 28, 28, 28, 28];

// LRT-1 Fare Matrix (PHP) - based on number of stations traveled
export const LRT1_FARES: number[] = [0, 12, 13, 15, 15, 16, 18, 20, 20, 20, 22, 23, 24, 24, 25, 25, 28, 28, 30, 30];

// LRT-2 Fare Matrix (PHP) - based on number of stations traveled
export const LRT2_FARES: number[] = [0, 12, 13, 15, 15, 16, 18, 20, 20, 20, 22, 23, 25];

export const FARE_TABLES: Record<LineId, number[]> = {
  'MRT-3': MRT3_FARES,
  'LRT-1': LRT1_FARES,
  'LRT-2': LRT2_FARES,
};

// Average travel time per station (minutes)
export const AVG_TIME_PER_STATION: Record<LineId, number> = {
  'MRT-3': 3,
  'LRT-1': 2.5,
  'LRT-2': 3,
};

// Transfer time between lines (minutes)
export const TRANSFER_TIME = 8;

// Walking speed estimate (minutes per 100m)
export const WALKING_SPEED = 1.5;

export interface FareResult {
  fare: number;
  travelTime: number;
  stations: number;
  line: LineId;
}

export interface RouteSegment {
  line: LineId;
  from: string;
  to: string;
  fromIndex: number;
  toIndex: number;
  stations: number;
  fare: number;
  time: number;
  direction: string;
  stationNames: string[];
}

export interface RouteResult {
  segments: RouteSegment[];
  totalFare: number;
  totalTime: number;
  totalStations: number;
  transfers: number;
  isCheapest?: boolean;
}

export function calculateFare(line: LineId, stationCount: number): number {
  const fareTable = FARE_TABLES[line];
  if (stationCount >= fareTable.length) {
    return fareTable[fareTable.length - 1];
  }
  return fareTable[stationCount];
}

export function calculateTravelTime(line: LineId, stationCount: number): number {
  return Math.round(stationCount * AVG_TIME_PER_STATION[line]);
}
