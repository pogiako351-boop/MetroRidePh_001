import { ALL_STATIONS } from '@/constants/stations';
import { CrowdLevel, Alert } from './storage';

export function generateMockCrowdLevels(): CrowdLevel[] {
  const levels: ('light' | 'moderate' | 'heavy')[] = ['light', 'moderate', 'heavy'];
  const weights = [0.5, 0.35, 0.15]; // 50% light, 35% moderate, 15% heavy

  const hour = new Date().getHours();
  // Rush hour adjustment
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);

  return ALL_STATIONS.map((station) => {
    let rand = Math.random();
    let level: 'light' | 'moderate' | 'heavy';

    if (isRushHour) {
      // During rush hour, more moderate and heavy
      if (rand < 0.2) level = 'light';
      else if (rand < 0.6) level = 'moderate';
      else level = 'heavy';
    } else {
      if (rand < weights[0]) level = levels[0];
      else if (rand < weights[0] + weights[1]) level = levels[1];
      else level = levels[2];
    }

    // Popular stations tend to be busier
    const popularStations = [
      'mrt3-ayala', 'mrt3-ortigas', 'mrt3-north-avenue', 'mrt3-araneta-cubao',
      'lrt1-monumento', 'lrt1-doroteo-jose', 'lrt1-baclaran', 'lrt1-edsa',
      'lrt2-recto', 'lrt2-araneta-cubao', 'lrt2-katipunan',
    ];

    if (popularStations.includes(station.id) && level === 'light') {
      level = 'moderate';
    }

    return {
      stationId: station.id,
      level,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function generateMockAlerts(): Alert[] {
  const now = new Date();
  return [
    {
      id: 'alert-1',
      title: 'MRT-3 Speed Restriction',
      description: 'Trains running at reduced speed between Shaw Boulevard and Ortigas due to track maintenance. Expect 5-10 minute delays.',
      line: 'MRT-3',
      severity: 'warning',
      createdAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      expiresAt: new Date(now.getTime() + 120 * 60000).toISOString(),
    },
    {
      id: 'alert-2',
      title: 'LRT-1 Extension Update',
      description: 'Cavite Extension construction ongoing. No service disruptions expected. New stations coming soon!',
      line: 'LRT-1',
      severity: 'info',
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      id: 'alert-3',
      title: 'LRT-2 Signal Issue Resolved',
      description: 'The signaling issue at Cubao station has been resolved. Train services are back to normal operations.',
      line: 'LRT-2',
      severity: 'info',
      createdAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: 'alert-4',
      title: 'Weekend Maintenance Notice',
      description: 'MRT-3 will undergo routine maintenance this Saturday from 10 PM to 5 AM Sunday. Last trip at 9:30 PM.',
      line: 'MRT-3',
      severity: 'warning',
      createdAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
    },
    {
      id: 'alert-5',
      title: 'Free Ride for Students',
      description: 'Reminder: Students with valid school IDs enjoy free rides on LRT-1 and LRT-2 during off-peak hours.',
      line: 'All Lines',
      severity: 'info',
      createdAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
    },
  ];
}

export function getNextTrainETA(): { minutes: number; seconds: number } {
  // Simulate next train arrival (3-8 minutes)
  const totalSeconds = Math.floor(Math.random() * 300) + 180;
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}
