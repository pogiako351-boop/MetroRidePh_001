import { LineId } from './stations';

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Types
// ─────────────────────────────────────────────────────────────────────────────
export type TicketType = 'beep' | 'sjt';

export const TICKET_TYPES: { id: TicketType; label: string; icon: string }[] = [
  { id: 'beep', label: 'Beep Card', icon: 'card' },
  { id: 'sjt', label: 'Single Journey', icon: 'ticket' },
];

/** Single Journey Ticket surcharge (PHP) */
export const SJT_SURCHARGE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Passenger Profiles
// ─────────────────────────────────────────────────────────────────────────────
export type PassengerProfile = 'regular' | 'student' | 'senior' | 'pwd';

export interface PassengerProfileInfo {
  id: PassengerProfile;
  label: string;
  shortLabel: string;
  icon: string;
  discountRate: number; // 0.0 – 1.0
  discountLabel: string;
}

export const PASSENGER_PROFILES: PassengerProfileInfo[] = [
  { id: 'regular', label: 'Regular', shortLabel: 'Reg', icon: 'person', discountRate: 0, discountLabel: 'No discount' },
  { id: 'student', label: 'Student', shortLabel: 'Stu', icon: 'school', discountRate: 0.2, discountLabel: '20% off' },
  { id: 'senior', label: 'Senior', shortLabel: 'Sen', icon: 'people', discountRate: 0.2, discountLabel: '20% off' },
  { id: 'pwd', label: 'PWD', shortLabel: 'PWD', icon: 'accessibility', discountRate: 0.2, discountLabel: '20% off' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Official 2026 LRT-2 Station-to-Station Fare Matrix
//
// Stations (lineIndex order):
//  0 – Recto          7 – Cubao
//  1 – Legarda         8 – Anonas
//  2 – Pureza          9 – Katipunan
//  3 – V. Mapa        10 – Santolan
//  4 – J. Ruiz        11 – Marikina-Pasig
//  5 – Gilmore        12 – Antipolo
//  6 – Betty Go-Belmonte
//
// All values are Beep Card (stored-value) fares in PHP.
// SJT adds a ₱2 surcharge; discounted riders (Student/Senior/PWD) receive 20% off.
// ─────────────────────────────────────────────────────────────────────────────
export const LRT2_FARE_MATRIX: number[][] = [
  //  0    1    2    3    4    5    6    7    8    9   10   11   12
  [  0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30,  32,  35 ], // 0 Recto
  [ 15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30,  32 ], // 1 Legarda
  [ 17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30 ], // 2 Pureza
  [ 19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28 ], // 3 V. Mapa
  [ 20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27 ], // 4 J. Ruiz
  [ 21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25 ], // 5 Gilmore
  [ 23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23 ], // 6 Betty Go-Belmonte
  [ 25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21 ], // 7 Cubao
  [ 27,  25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20 ], // 8 Anonas
  [ 28,  27,  25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19 ], // 9 Katipunan
  [ 30,  28,  27,  25,  23,  21,  20,  19,  17,  15,   0,  15,  17 ], // 10 Santolan
  [ 32,  30,  28,  27,  25,  23,  21,  20,  19,  17,  15,   0,  15 ], // 11 Marikina-Pasig
  [ 35,  32,  30,  28,  27,  25,  23,  21,  20,  19,  17,  15,   0 ], // 12 Antipolo
];

/** Retrieve exact LRT-2 Beep Card fare from the official 2026 matrix. */
export function getLRT2Fare(fromIndex: number, toIndex: number): number {
  const row = LRT2_FARE_MATRIX[fromIndex];
  if (!row) return 0;
  return row[toIndex] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MRT-3 Fare Array (PHP) – indexed by number of stations traveled
// ─────────────────────────────────────────────────────────────────────────────
export const MRT3_FARES: number[] = [0, 13, 16, 16, 20, 20, 24, 24, 24, 28, 28, 28, 28];

// ─────────────────────────────────────────────────────────────────────────────
// LRT-1 Fare Array (PHP) – indexed by number of stations traveled
// ─────────────────────────────────────────────────────────────────────────────
export const LRT1_FARES: number[] = [0, 12, 13, 15, 15, 16, 18, 20, 20, 20, 22, 23, 24, 24, 25, 25, 28, 28, 30, 30];

// ─────────────────────────────────────────────────────────────────────────────
// LRT-2 distance-based array kept for backward compat with route planner.
// The precise matrix above should be used when fromIndex/toIndex are known.
// ─────────────────────────────────────────────────────────────────────────────
export const LRT2_FARES: number[] = [0, 15, 17, 19, 20, 21, 23, 25, 27, 28, 30, 32, 35];

export const FARE_TABLES: Record<LineId, number[]> = {
  'MRT-3': MRT3_FARES,
  'LRT-1': LRT1_FARES,
  'LRT-2': LRT2_FARES,
};

// ─────────────────────────────────────────────────────────────────────────────
// Travel time constants
// ─────────────────────────────────────────────────────────────────────────────
/** Average travel time per station (minutes) */
export const AVG_TIME_PER_STATION: Record<LineId, number> = {
  'MRT-3': 3,
  'LRT-1': 2.5,
  'LRT-2': 3,
};

/** Transfer time between lines (minutes) */
export const TRANSFER_TIME = 8;

/** Walking speed estimate (minutes per 100 m) */
export const WALKING_SPEED = 1.5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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

export interface FareBreakdown {
  baseFare: number;
  sjtSurcharge: number;
  discountAmount: number;
  discountRate: number;
  finalFare: number;
  ticketType: TicketType;
  passengerProfile: PassengerProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fare calculation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate base fare for a single line segment.
 * For LRT-2 segments, pass fromIndex + toIndex to use the official matrix.
 */
export function calculateFare(
  line: LineId,
  stationCount: number,
  fromIndex?: number,
  toIndex?: number,
): number {
  if (line === 'LRT-2' && fromIndex !== undefined && toIndex !== undefined) {
    return getLRT2Fare(fromIndex, toIndex);
  }
  const fareTable = FARE_TABLES[line];
  const idx = Math.min(stationCount, fareTable.length - 1);
  return fareTable[idx];
}

export function calculateTravelTime(line: LineId, stationCount: number): number {
  return Math.round(stationCount * AVG_TIME_PER_STATION[line]);
}

/**
 * Compute a full fare breakdown including ticket-type surcharge and passenger discount.
 */
export function computeFareBreakdown(
  baseFare: number,
  ticketType: TicketType,
  passengerProfile: PassengerProfile,
): FareBreakdown {
  const profile = PASSENGER_PROFILES.find((p) => p.id === passengerProfile)!;
  const sjtSurcharge = ticketType === 'sjt' ? SJT_SURCHARGE : 0;
  const fareBeforeDiscount = baseFare + sjtSurcharge;
  const discountAmount = Math.round(fareBeforeDiscount * profile.discountRate);
  const finalFare = fareBeforeDiscount - discountAmount;

  return {
    baseFare,
    sjtSurcharge,
    discountAmount,
    discountRate: profile.discountRate,
    finalFare,
    ticketType,
    passengerProfile,
  };
}
