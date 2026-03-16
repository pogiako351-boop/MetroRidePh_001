import {
  ALL_STATIONS,
  Station,
  LineId,
  getStationsByLine,
} from '@/constants/stations';
import {
  calculateFare,
  calculateTravelTime,
  TRANSFER_TIME,
  RouteResult,
  RouteSegment,
} from '@/constants/fares';

// Transfer connections between lines
interface TransferConnection {
  line1: LineId;
  station1Id: string;
  line2: LineId;
  station2Id: string;
}

const TRANSFERS: TransferConnection[] = [
  {
    line1: 'MRT-3',
    station1Id: 'mrt3-araneta-cubao',
    line2: 'LRT-2',
    station2Id: 'lrt2-araneta-cubao',
  },
  {
    line1: 'MRT-3',
    station1Id: 'mrt3-taft-avenue',
    line2: 'LRT-1',
    station2Id: 'lrt1-edsa',
  },
  {
    line1: 'LRT-1',
    station1Id: 'lrt1-doroteo-jose',
    line2: 'LRT-2',
    station2Id: 'lrt2-recto',
  },
];

function getDirection(line: LineId, fromIndex: number, toIndex: number): string {
  if (line === 'MRT-3') {
    return fromIndex < toIndex ? 'Southbound (to Taft Ave)' : 'Northbound (to North Ave)';
  }
  if (line === 'LRT-1') {
    return fromIndex < toIndex ? 'Southbound (to Dr. Santos)' : 'Northbound (to FPJ)';
  }
  return fromIndex < toIndex ? 'Eastbound (to Antipolo)' : 'Westbound (to Recto)';
}

function getStationNamesBetween(line: LineId, fromIndex: number, toIndex: number): string[] {
  const lineStations = getStationsByLine(line);
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const names = lineStations.slice(start, end + 1).map((s) => s.name);
  return fromIndex <= toIndex ? names : names.reverse();
}

function buildDirectRoute(from: Station, to: Station): RouteSegment {
  const stationCount = Math.abs(from.lineIndex - to.lineIndex);
  return {
    line: from.line,
    from: from.name,
    to: to.name,
    fromIndex: from.lineIndex,
    toIndex: to.lineIndex,
    stations: stationCount,
    // For LRT-2, pass fromIndex/toIndex so calculateFare uses the official matrix
    fare: calculateFare(from.line, stationCount, from.lineIndex, to.lineIndex),
    time: calculateTravelTime(from.line, stationCount),
    direction: getDirection(from.line, from.lineIndex, to.lineIndex),
    stationNames: getStationNamesBetween(from.line, from.lineIndex, to.lineIndex),
  };
}

export function findRoutes(fromId: string, toId: string): RouteResult[] {
  const from = ALL_STATIONS.find((s) => s.id === fromId);
  const to = ALL_STATIONS.find((s) => s.id === toId);

  if (!from || !to) return [];

  const routes: RouteResult[] = [];

  // Same line - direct route
  if (from.line === to.line) {
    const segment = buildDirectRoute(from, to);
    routes.push({
      segments: [segment],
      totalFare: segment.fare,
      totalTime: segment.time,
      totalStations: segment.stations,
      transfers: 0,
    });
    return routes;
  }

  // Different lines - find transfer routes
  for (const transfer of TRANSFERS) {
    let firstSegmentFrom: Station | undefined;
    let firstSegmentTo: Station | undefined;
    let secondSegmentFrom: Station | undefined;
    let secondSegmentTo: Station | undefined;

    // Check if this transfer connects the two lines
    if (from.line === transfer.line1 && to.line === transfer.line2) {
      firstSegmentFrom = from;
      firstSegmentTo = ALL_STATIONS.find((s) => s.id === transfer.station1Id);
      secondSegmentFrom = ALL_STATIONS.find((s) => s.id === transfer.station2Id);
      secondSegmentTo = to;
    } else if (from.line === transfer.line2 && to.line === transfer.line1) {
      firstSegmentFrom = from;
      firstSegmentTo = ALL_STATIONS.find((s) => s.id === transfer.station2Id);
      secondSegmentFrom = ALL_STATIONS.find((s) => s.id === transfer.station1Id);
      secondSegmentTo = to;
    }

    if (firstSegmentFrom && firstSegmentTo && secondSegmentFrom && secondSegmentTo) {
      const seg1 = buildDirectRoute(firstSegmentFrom, firstSegmentTo);
      const seg2 = buildDirectRoute(secondSegmentFrom, secondSegmentTo);

      routes.push({
        segments: [seg1, seg2],
        totalFare: seg1.fare + seg2.fare,
        totalTime: seg1.time + TRANSFER_TIME + seg2.time,
        totalStations: seg1.stations + seg2.stations,
        transfers: 1,
      });
    }
  }

  // Multi-transfer routes (3 lines)
  if (routes.length === 0) {
    // Try going through intermediate line
    for (const t1 of TRANSFERS) {
      for (const t2 of TRANSFERS) {
        if (t1 === t2) continue;

        // Find a path: from.line -> midLine -> to.line
        let midLine: LineId | null = null;
        let path: { s1From: string; s1To: string; s2From: string; s2To: string; s3From: string; s3To: string } | null = null;

        if (from.line === t1.line1 && t1.line2 === t2.line1 && to.line === t2.line2) {
          midLine = t1.line2;
          path = { s1From: from.id, s1To: t1.station1Id, s2From: t1.station2Id, s2To: t2.station1Id, s3From: t2.station2Id, s3To: to.id };
        } else if (from.line === t1.line1 && t1.line2 === t2.line2 && to.line === t2.line1) {
          midLine = t1.line2;
          path = { s1From: from.id, s1To: t1.station1Id, s2From: t1.station2Id, s2To: t2.station2Id, s3From: t2.station1Id, s3To: to.id };
        } else if (from.line === t1.line2 && t1.line1 === t2.line1 && to.line === t2.line2) {
          midLine = t1.line1;
          path = { s1From: from.id, s1To: t1.station2Id, s2From: t1.station1Id, s2To: t2.station1Id, s3From: t2.station2Id, s3To: to.id };
        } else if (from.line === t1.line2 && t1.line1 === t2.line2 && to.line === t2.line1) {
          midLine = t1.line1;
          path = { s1From: from.id, s1To: t1.station2Id, s2From: t1.station1Id, s2To: t2.station2Id, s3From: t2.station1Id, s3To: to.id };
        }

        if (midLine && path) {
          const s1From = ALL_STATIONS.find((s) => s.id === path!.s1From);
          const s1To = ALL_STATIONS.find((s) => s.id === path!.s1To);
          const s2From = ALL_STATIONS.find((s) => s.id === path!.s2From);
          const s2To = ALL_STATIONS.find((s) => s.id === path!.s2To);
          const s3From = ALL_STATIONS.find((s) => s.id === path!.s3From);
          const s3To = ALL_STATIONS.find((s) => s.id === path!.s3To);

          if (s1From && s1To && s2From && s2To && s3From && s3To) {
            const seg1 = buildDirectRoute(s1From, s1To);
            const seg2 = buildDirectRoute(s2From, s2To);
            const seg3 = buildDirectRoute(s3From, s3To);

            const existing = routes.find(
              (r) => r.segments.length === 3 && r.totalFare === seg1.fare + seg2.fare + seg3.fare
            );
            if (!existing) {
              routes.push({
                segments: [seg1, seg2, seg3],
                totalFare: seg1.fare + seg2.fare + seg3.fare,
                totalTime: seg1.time + TRANSFER_TIME + seg2.time + TRANSFER_TIME + seg3.time,
                totalStations: seg1.stations + seg2.stations + seg3.stations,
                transfers: 2,
              });
            }
          }
        }
      }
    }
  }

  // Sort by fare (cheapest first) and mark cheapest
  routes.sort((a, b) => a.totalFare - b.totalFare);
  if (routes.length > 0) {
    routes[0].isCheapest = true;
  }

  return routes;
}
