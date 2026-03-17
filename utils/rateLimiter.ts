/**
 * MetroRide PH — Client-Side Rate Limiter
 * Protects against API abuse, bot scraping, and traffic flooding.
 * Enforces 30 requests/min for Supabase, 10/min for AI endpoints.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = '@metroride_rate_limit';
const BOT_DETECT_KEY = '@metroride_bot_detection';

/** Per-endpoint rate limits (requests per minute) */
const ENDPOINT_LIMITS: Record<string, number> = {
  supabase:  30,
  newell:    10,
  fastshot:  10,
  reports:    5,
  default:   30,
};

/** Burst detection: requests within 10 seconds */
const BOT_BURST_WINDOW_MS  = 10_000;
const BOT_BURST_THRESHOLD  = 20;   // 20 req in 10s = bot
const BOT_BLOCK_DURATION_MS = 5 * 60_000; // 5 min block
const RATE_WINDOW_MS = 60_000; // 1 minute sliding window

export interface RateLimitEntry {
  endpoint: string;
  timestamps: number[];
  blocked: boolean;
  blockedUntil?: number;
}

export interface BotDetectionState {
  suspiciousEvents: Array<{
    timestamp: number;
    type: 'flood' | 'pattern' | 'rapid_repeat';
    endpoint: string;
  }>;
  isBlocked: boolean;
  blockedUntil?: number;
}

export interface RateLimiterStats {
  endpoints: Array<{
    name: string;
    requestsPerMin: number;
    limit: number;
    blocked: boolean;
  }>;
  isBotDetected: boolean;
  totalRequests: number;
}

class RateLimiterClass {
  private state: Map<string, RateLimitEntry> = new Map();
  private botState: BotDetectionState = {
    suspiciousEvents: [],
    isBlocked: false,
  };
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as RateLimitEntry[];
        saved.forEach((e) => this.state.set(e.endpoint, e));
      }
      const botRaw = await AsyncStorage.getItem(BOT_DETECT_KEY);
      if (botRaw) {
        this.botState = JSON.parse(botRaw) as BotDetectionState;
      }
    } catch {
      // Start fresh on storage error
    }
  }

  private async persistState(): Promise<void> {
    try {
      const entries = Array.from(this.state.values());
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(entries));
    } catch {
      // Silent
    }
  }

  private getLimit(endpoint: string): number {
    for (const [key, limit] of Object.entries(ENDPOINT_LIMITS)) {
      if (key !== 'default' && endpoint.toLowerCase().includes(key)) {
        return limit;
      }
    }
    return ENDPOINT_LIMITS.default;
  }

  /**
   * Check if a request should be allowed.
   * Returns { allowed: true } or { allowed: false, retryAfter, reason }.
   */
  async checkRequest(endpoint: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
    reason?: string;
  }> {
    await this.init();

    const now = Date.now();

    // ── Bot block check ──────────────────────────────────────────────────
    if (
      this.botState.isBlocked &&
      this.botState.blockedUntil &&
      now < this.botState.blockedUntil
    ) {
      return {
        allowed: false,
        retryAfter: this.botState.blockedUntil - now,
        reason: 'bot_blocked',
      };
    }
    // Clear expired bot block
    if (this.botState.isBlocked && this.botState.blockedUntil && now >= this.botState.blockedUntil) {
      this.botState.isBlocked = false;
      this.botState.blockedUntil = undefined;
    }

    // ── Retrieve or create rate limit entry ──────────────────────────────
    const entry: RateLimitEntry = this.state.get(endpoint) ?? {
      endpoint,
      timestamps: [],
      blocked: false,
    };

    // Prune timestamps outside the sliding window
    const windowStart = now - RATE_WINDOW_MS;
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const limit = this.getLimit(endpoint);

    // ── Rate limit check ─────────────────────────────────────────────────
    if (entry.timestamps.length >= limit) {
      entry.blocked = true;
      const oldestInWindow = entry.timestamps[0];
      const retryAfter = oldestInWindow + RATE_WINDOW_MS - now;
      this.state.set(endpoint, entry);
      await this.persistState();
      return { allowed: false, retryAfter, reason: 'rate_limited' };
    }

    // ── Bot burst detection ──────────────────────────────────────────────
    const recentBurst = entry.timestamps.filter(
      (t) => t > now - BOT_BURST_WINDOW_MS,
    );
    if (recentBurst.length >= BOT_BURST_THRESHOLD) {
      this.botState.suspiciousEvents.push({
        timestamp: now,
        type: 'flood',
        endpoint,
      });
      this.botState.isBlocked = true;
      this.botState.blockedUntil = now + BOT_BLOCK_DURATION_MS;
      try {
        await AsyncStorage.setItem(BOT_DETECT_KEY, JSON.stringify(this.botState));
      } catch {
        // Silent
      }
      return {
        allowed: false,
        retryAfter: BOT_BLOCK_DURATION_MS,
        reason: 'bot_detected',
      };
    }

    // ── Allow request ────────────────────────────────────────────────────
    entry.timestamps.push(now);
    entry.blocked = false;
    this.state.set(endpoint, entry);
    await this.persistState();

    return { allowed: true };
  }

  /** Get current stats for monitoring dashboards */
  getStats(): RateLimiterStats {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;

    const endpoints = Array.from(this.state.values()).map((e) => ({
      name: e.endpoint,
      requestsPerMin: e.timestamps.filter((t) => t > windowStart).length,
      limit: this.getLimit(e.endpoint),
      blocked:
        e.blocked ||
        !!(e.blockedUntil && now < e.blockedUntil),
    }));

    const totalRequests = endpoints.reduce((s, e) => s + e.requestsPerMin, 0);

    return {
      endpoints,
      isBotDetected:
        this.botState.isBlocked ||
        this.botState.suspiciousEvents.some(
          (ev) => ev.timestamp > now - 10 * 60_000,
        ),
      totalRequests,
    };
  }

  getBotDetectionState(): BotDetectionState {
    return { ...this.botState };
  }

  /** Reset rate limiting state (admin override) */
  async reset(endpoint?: string): Promise<void> {
    if (endpoint) {
      this.state.delete(endpoint);
    } else {
      this.state.clear();
      this.botState = { suspiciousEvents: [], isBlocked: false };
      try {
        await AsyncStorage.removeItem(BOT_DETECT_KEY);
      } catch {
        // Silent
      }
    }
    await this.persistState();
  }
}

export const rateLimiter = new RateLimiterClass();
export default rateLimiter;
