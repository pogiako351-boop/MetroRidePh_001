/**
 * MetroRide PH — Background Error Logger
 * Captures MetroAI response failures and real-time sync errors
 * for future monitoring and diagnostics.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = '@metroride_error_logs';
const MAX_LOGS = 100;

export type ErrorLogType =
  | 'ai_text'
  | 'ai_vision'
  | 'ai_voice'
  | 'sync_error'
  | 'sync_offline'
  | 'general';

export interface ErrorLog {
  id: string;
  timestamp: string;
  type: ErrorLogType;
  error: string;
  context?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Log an error to AsyncStorage in the background.
 * This function is intentionally silent — it never throws or blocks the UI.
 */
export async function logError(
  type: ErrorLogType,
  error: unknown,
  context?: string,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : JSON.stringify(error);

    const newLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      error: errorMessage,
      context,
      metadata,
    };

    const raw = await AsyncStorage.getItem(LOG_KEY);
    const existing: ErrorLog[] = raw ? (JSON.parse(raw) as ErrorLog[]) : [];
    const updated = [newLog, ...existing].slice(0, MAX_LOGS);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail — logging must never crash the app
  }
}

/**
 * Retrieve all stored error logs (newest first).
 */
export async function getErrorLogs(): Promise<ErrorLog[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as ErrorLog[]) : [];
  } catch {
    return [];
  }
}

/**
 * Get a summary of recent errors for diagnostics display.
 */
export async function getErrorSummary(): Promise<{
  total: number;
  aiErrors: number;
  syncErrors: number;
  lastError: string | null;
}> {
  const logs = await getErrorLogs();
  const aiErrors = logs.filter((l) =>
    ['ai_text', 'ai_vision', 'ai_voice'].includes(l.type)
  ).length;
  const syncErrors = logs.filter((l) =>
    ['sync_error', 'sync_offline'].includes(l.type)
  ).length;
  const lastError = logs.length > 0 ? logs[0].timestamp : null;

  return { total: logs.length, aiErrors, syncErrors, lastError };
}

/**
 * Clear all stored error logs.
 */
export async function clearErrorLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_KEY);
  } catch {
    // Silent fail
  }
}
