// MetroRide PH — Netlify Serverless Function
// Full CRUD pipeline for community reports via Supabase.
// Silent error handling: returns empty arrays / success:false on failure.

const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// Map Supabase snake_case row → frontend camelCase shape
function mapReport(row) {
  return {
    id: row.id,
    category: row.category,
    stationId: row.station_id,
    stationName: row.station_name,
    line: row.line,
    description: row.description || undefined,
    upvotes: row.upvotes ?? 1,
    upvotedBy: row.upvoted_by ?? [],
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    reporterId: row.reporter_id,
  };
}

exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const supabase = getSupabase();

  // ── GET: Fetch last 50 active reports ordered by timestamp ─────────────────
  if (event.httpMethod === 'GET') {
    if (!supabase) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ reports: [], source: 'unconfigured' }),
      };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('community_reports')
        .select('id, category, station_id, station_name, line, description, upvotes, upvoted_by, created_at, expires_at, reporter_id')
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ reports: (data ?? []).map(mapReport), source: 'supabase' }),
      };
    } catch {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ reports: [], source: 'error' }),
      };
    }
  }

  // ── POST: Create new report OR upvote ──────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: 'Invalid JSON' }),
      };
    }

    if (!supabase) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, source: 'unconfigured' }),
      };
    }

    // Handle upvote action
    if (body.action === 'upvote') {
      try {
        const { reportId, userId } = body;
        if (!reportId || !userId) throw new Error('Missing reportId or userId');

        // Fetch current report to avoid duplicates
        const { data: current, error: fetchErr } = await supabase
          .from('community_reports')
          .select('upvotes, upvoted_by')
          .eq('id', reportId)
          .single();

        if (fetchErr || !current) throw fetchErr || new Error('Report not found');

        if (!current.upvoted_by.includes(userId)) {
          const { error: updateErr } = await supabase
            .from('community_reports')
            .update({
              upvotes: current.upvotes + 1,
              upvoted_by: [...current.upvoted_by, userId],
            })
            .eq('id', reportId);
          if (updateErr) throw updateErr;
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: true }),
        };
      } catch {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false }),
        };
      }
    }

    // Handle new report submission
    try {
      const {
        id, category, stationId, stationName, line,
        description, reporterId, createdAt, expiresAt,
      } = body;

      const { data, error } = await supabase
        .from('community_reports')
        .insert([{
          id,
          category,
          station_id: stationId,
          station_name: stationName,
          line,
          description: description || null,
          upvotes: 1,
          upvoted_by: [reporterId],
          created_at: new Date(createdAt).toISOString(),
          expires_at: new Date(expiresAt).toISOString(),
          reporter_id: reporterId,
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, report: data ? mapReport(data) : null }),
      };
    } catch {
      // Don't fail the UX — report saved locally already
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
