// MetroRide PH — Netlify Serverless Function
// Fetches live transit alerts and crowd levels from Supabase.
// Returns empty arrays silently on any error so the PWA gracefully degrades.

const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ alerts: [], crowdLevels: [] }),
    };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  // If credentials are missing, return empty payload
  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ alerts: [], crowdLevels: [], source: 'unconfigured' }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();

    // Parallel fetch for optimal performance
    const [alertsResult, crowdResult] = await Promise.all([
      supabase
        .from('transit_alerts')
        .select('id, title, description, line, severity, created_at, expires_at')
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('crowd_levels')
        .select('station_id, station_name, line, level, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200),
    ]);

    // Map to frontend-friendly camelCase format
    const alerts = (alertsResult.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      line: a.line,
      severity: a.severity,
      createdAt: a.created_at,
      expiresAt: a.expires_at,
    }));

    const crowdLevels = (crowdResult.data ?? []).map((c) => ({
      stationId: c.station_id,
      stationName: c.station_name,
      line: c.line,
      level: c.level,
      updatedAt: c.updated_at,
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ alerts, crowdLevels, source: 'supabase', timestamp: now }),
    };
  } catch {
    // Silent failure — return empty arrays so the PWA degrades gracefully
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ alerts: [], crowdLevels: [], source: 'error' }),
    };
  }
};
