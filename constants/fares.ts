import { LineId } from './stations';

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Types
// ─────────────────────────────────────────────────────────────────────────────
export type TicketType = 'beep' | 'sjt';

export const TICKET_TYPES: { id: TicketType; label: string; shortLabel: string; icon: string }[] = [
  { id: 'beep', label: 'Beep / Stored Value', shortLabel: 'Beep Card', icon: 'card' },
  { id: 'sjt', label: 'Single Journey (SJT)', shortLabel: 'SJT', icon: 'ticket' },
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
// Line Branding — Official 2026 MetroRide PH Color Palette
// ─────────────────────────────────────────────────────────────────────────────
export const LINE_BRAND_COLORS: Record<
  LineId,
  { primary: string; soft: string; textOnBrand: string; softText: string }
> = {
  'LRT-1': { primary: '#FFE600', soft: 'rgba(255,230,0,0.10)', textOnBrand: '#08090A', softText: '#FFE600' },
  'MRT-3': { primary: '#4499FF', soft: 'rgba(68,153,255,0.10)', textOnBrand: '#FFFFFF', softText: '#4499FF' },
  'LRT-2': { primary: '#BB44FF', soft: 'rgba(187,68,255,0.10)', textOnBrand: '#FFFFFF', softText: '#BB44FF' },
};

export const LINE_ICONS: Record<LineId, string> = {
  'LRT-1': 'L1',
  'MRT-3': 'M3',
  'LRT-2': 'L2',
};

export const LINE_FULL_NAMES: Record<LineId, string> = {
  'LRT-1': 'LRT Line 1',
  'MRT-3': 'MRT Line 3',
  'LRT-2': 'LRT Line 2',
};

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
  [  0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30,  32,  35 ], // 0  Recto
  [ 15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30,  32 ], // 1  Legarda
  [ 17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28,  30 ], // 2  Pureza
  [ 19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27,  28 ], // 3  V. Mapa
  [ 20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25,  27 ], // 4  J. Ruiz
  [ 21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23,  25 ], // 5  Gilmore
  [ 23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21,  23 ], // 6  Betty Go-Belmonte
  [ 25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20,  21 ], // 7  Cubao
  [ 27,  25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19,  20 ], // 8  Anonas
  [ 28,  27,  25,  23,  21,  20,  19,  17,  15,   0,  15,  17,  19 ], // 9  Katipunan
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
// Official 2026 MRT-3 Distance-Based Fare Array
//
// Stations (lineIndex order, 0 = North Avenue, 12 = Taft Avenue):
//  0 – North Avenue       7 – Boni
//  1 – Quezon Avenue      8 – Guadalupe
//  2 – GMA Kamuning       9 – Buendia
//  3 – Araneta-Cubao     10 – Ayala
//  4 – Santolan-Annapolis 11 – Magallanes
//  5 – Ortigas            12 – Taft Avenue
//  6 – Shaw Boulevard
// ─────────────────────────────────────────────────────────────────────────────
export const MRT3_FARES: number[] = [0, 13, 16, 16, 20, 20, 24, 24, 24, 28, 28, 28, 28];

/** Official 2026 MRT-3 station-to-station fare matrix (Beep Card). */
export const MRT3_FARE_MATRIX: number[][] = Array.from({ length: 13 }, (_, i) =>
  Array.from({ length: 13 }, (_, j) => MRT3_FARES[Math.abs(i - j)]),
);

/** Retrieve exact MRT-3 Beep Card fare from the official 2026 matrix. */
export function getMRT3Fare(fromIndex: number, toIndex: number): number {
  const row = MRT3_FARE_MATRIX[fromIndex];
  if (!row) return 0;
  return row[toIndex] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Official 2026 LRT-1 Fare Engine
//
// Stations (lineIndex order, 0 = FPJ, 24 = Dr. Santos):
//  0 – Fernando Poe Jr. (FPJ)   10 – Carriedo
//  1 – Balintawak                11 – Central Terminal
//  2 – Monumento                 12 – United Nations
//  3 – 5th Avenue                13 – Pedro Gil
//  4 – R. Papa                   14 – Quirino
//  5 – Abad Santos               15 – Vito Cruz
//  6 – Blumentritt               16 – Gil Puyat
//  7 – Tayuman                   17 – Libertad
//  8 – Bambang                   18 – EDSA
//  9 – Doroteo Jose              19 – Baclaran
// ─── Cavite Extension ──────────────────────────────────────────────────────
// 20 – Redemptorist-Aseana      22 – PITX
// 21 – MIA Road                 23 – Ninoy Aquino Ave
//                               24 – Dr. Santos
//
// Formula: Beep = clamp(round(₱16.25 + km × ₱1.47), ₱16, ₱52)
//          SJT  = clamp(round(₱16.25 + km × ₱1.47 + ₱2), ₱20, ₱55)
// ─────────────────────────────────────────────────────────────────────────────

/** 2026 LRT-1 boarding fare (PHP) */
export const LRT1_BOARDING_FARE = 16.25;
/** 2026 LRT-1 per-km distance fare (PHP/km) */
export const LRT1_PER_KM_FARE = 1.47;
/** 2026 LRT-1 Beep Card minimum fare (PHP) */
export const LRT1_BEEP_MIN = 16;
/** 2026 LRT-1 Beep Card maximum fare (PHP) */
export const LRT1_BEEP_MAX = 52;
/** 2026 LRT-1 Single Journey Ticket minimum fare (PHP) */
export const LRT1_SJT_MIN = 20;
/** 2026 LRT-1 Single Journey Ticket maximum fare (PHP) */
export const LRT1_SJT_MAX = 55;

/**
 * GPS coordinates [lat, lon] for each LRT-1 station in lineIndex order (0–24).
 * Used to compute exact inter-station distances for the 2026 km-based fare formula.
 */
export const LRT1_STATION_COORDS: [number, number][] = [
  [14.6575, 120.9837], //  0 FPJ
  [14.6574, 120.9937], //  1 Balintawak
  [14.6545, 120.9838], //  2 Monumento
  [14.6444, 120.9835], //  3 5th Avenue
  [14.6358, 120.9832], //  4 R. Papa
  [14.6303, 120.9815], //  5 Abad Santos
  [14.6227, 120.9828], //  6 Blumentritt
  [14.6165, 120.9828], //  7 Tayuman
  [14.6110, 120.9824], //  8 Bambang
  [14.6055, 120.9819], //  9 Doroteo Jose
  [14.5990, 120.9810], // 10 Carriedo
  [14.5925, 120.9816], // 11 Central Terminal
  [14.5822, 120.9846], // 12 United Nations
  [14.5762, 120.9879], // 13 Pedro Gil
  [14.5703, 120.9914], // 14 Quirino
  [14.5636, 120.9946], // 15 Vito Cruz
  [14.5544, 120.9966], // 16 Gil Puyat
  [14.5477, 120.9985], // 17 Libertad
  [14.5392, 121.0005], // 18 EDSA
  [14.5340, 120.9982], // 19 Baclaran
  [14.5218, 121.0003], // 20 Redemptorist-Aseana
  [14.5131, 120.9985], // 21 MIA Road
  [14.4985, 120.9925], // 22 PITX
  [14.4865, 120.9892], // 23 Ninoy Aquino Ave
  [14.4714, 120.9849], // 24 Dr. Santos
];

/** Haversine distance (km) between two GPS coordinates. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Cumulative distance (km) from FPJ (station 0) to each station.
 * Pre-computed from GPS coordinates using the haversine formula.
 */
export const LRT1_CUMULATIVE_KM: number[] = (() => {
  const result: number[] = [0];
  for (let i = 1; i < LRT1_STATION_COORDS.length; i++) {
    const [lat1, lon1] = LRT1_STATION_COORDS[i - 1];
    const [lat2, lon2] = LRT1_STATION_COORDS[i];
    result.push(result[i - 1] + haversineKm(lat1, lon1, lat2, lon2));
  }
  return result;
})();

/** Compute raw (uncapped) LRT-1 km-based fare between two station indices. */
function lrt1RawFare(fromIndex: number, toIndex: number): number {
  const distKm = Math.abs(
    (LRT1_CUMULATIVE_KM[fromIndex] ?? 0) - (LRT1_CUMULATIVE_KM[toIndex] ?? 0),
  );
  return Math.round(LRT1_BOARDING_FARE + distKm * LRT1_PER_KM_FARE);
}

/**
 * Official 2026 LRT-1 distance-based fare array.
 * Index = stations from FPJ; value = Beep Card fare in PHP.
 * Covers all 25 stations (0–24) including the Cavite Extension.
 */
export const LRT1_FARES: number[] = LRT1_CUMULATIVE_KM.map((km) =>
  Math.max(LRT1_BEEP_MIN, Math.min(LRT1_BEEP_MAX, Math.round(LRT1_BOARDING_FARE + km * LRT1_PER_KM_FARE))),
);

/** Official 2026 LRT-1 station-to-station fare matrix (Beep Card). */
export const LRT1_FARE_MATRIX: number[][] = Array.from(
  { length: LRT1_STATION_COORDS.length },
  (_, i) =>
    Array.from({ length: LRT1_STATION_COORDS.length }, (__, j) =>
      Math.max(LRT1_BEEP_MIN, Math.min(LRT1_BEEP_MAX, lrt1RawFare(i, j))),
    ),
);

/** Retrieve exact LRT-1 Beep Card fare from the official 2026 km-based matrix. */
export function getLRT1Fare(fromIndex: number, toIndex: number): number {
  const row = LRT1_FARE_MATRIX[fromIndex];
  if (!row) return LRT1_BEEP_MIN;
  return row[toIndex] ?? LRT1_BEEP_MIN;
}

/** Retrieve exact LRT-1 Single Journey Ticket fare (2026, with SJT caps). */
export function getLRT1SJTFare(fromIndex: number, toIndex: number): number {
  const raw = lrt1RawFare(fromIndex, toIndex);
  return Math.max(LRT1_SJT_MIN, Math.min(LRT1_SJT_MAX, raw + SJT_SURCHARGE));
}

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
// Smart Savings tooltip data per line
// ─────────────────────────────────────────────────────────────────────────────
export const LINE_MAX_FARES: Record<LineId, number> = {
  'LRT-1': LRT1_BEEP_MAX,
  'MRT-3': 28,
  'LRT-2': 35,
};

export const LINE_SAVINGS_TIPS: Record<LineId, string> = {
  'LRT-1': 'Beep Card capped at ₱52 (max). Discounted riders (Senior/PWD/Student) save 20% — up to ₱10 off on long trips. SJT minimum is ₱20.',
  'MRT-3': 'Switch to Beep Card to save ₱2/trip. Discounted riders save up to ₱7.60 on the full MRT-3 route.',
  'LRT-2': 'Switch to Beep Card to save ₱2/trip. Discounted riders save up to ₱9.40 on the full LRT-2 route.',
};

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
 * All lines now use official 2026 station-to-station precision matrices
 * when fromIndex + toIndex are provided.
 */
export function calculateFare(
  line: LineId,
  stationCount: number,
  fromIndex?: number,
  toIndex?: number,
): number {
  if (fromIndex !== undefined && toIndex !== undefined) {
    if (line === 'LRT-2') return getLRT2Fare(fromIndex, toIndex);
    if (line === 'LRT-1') return getLRT1Fare(fromIndex, toIndex);
    if (line === 'MRT-3') return getMRT3Fare(fromIndex, toIndex);
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
 * Rounding follows LRTA/DOTC standard: round to nearest peso.
 *
 * For LRT-1 (2026 formula):
 *  - Beep: baseFare is already the capped beep fare [₱16–₱52].
 *  - SJT:  fare = clamp(baseFare + ₱2, ₱20, ₱55), shown as actual surcharge.
 * Discount (20% for Senior/PWD/Student) is applied to the post-cap fare.
 */
export function computeFareBreakdown(
  baseFare: number,
  ticketType: TicketType,
  passengerProfile: PassengerProfile,
  line?: LineId,
): FareBreakdown {
  const profile = PASSENGER_PROFILES.find((p) => p.id === passengerProfile)!;

  let sjtSurcharge: number;
  let fareBeforeDiscount: number;

  if (line === 'LRT-1' && ticketType === 'sjt') {
    // Apply 2026 LRT-1 SJT price caps [₱20–₱55]
    const sjtFare = Math.max(LRT1_SJT_MIN, Math.min(LRT1_SJT_MAX, baseFare + SJT_SURCHARGE));
    sjtSurcharge = sjtFare - baseFare;
    fareBeforeDiscount = sjtFare;
  } else {
    sjtSurcharge = ticketType === 'sjt' ? SJT_SURCHARGE : 0;
    fareBeforeDiscount = baseFare + sjtSurcharge;
  }

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

/**
 * Derive the primary display line from a route (the line with the most stations,
 * or the single line for direct routes).
 */
export function getPrimaryLine(segments: RouteSegment[]): LineId {
  if (segments.length === 1) return segments[0].line;
  return segments.reduce((a, b) => (a.stations >= b.stations ? a : b)).line;
}
