/**
 * MetroRide PH — Offline Background Sync Queue v1
 *
 * Queues commuter updates (crowd levels, community reports, upvotes)
 * made while in Offline Mode and automatically flushes them when
 * connectivity is restored.
 *
 * Sync triggers:
 *   - Web:    window 'online' event + Background Sync API (if supported)
 *   - Native: Flush on startup + retry on next app session
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const QUEUE_KEY = '@metroride_sync_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_ATTEMPTS = 3;
const FLUSH_DEBOUNCE_MS = 1500; // Allow 1.5 s for network to stabilise after coming online

// ── Types ─────────────────────────────────────────────────────────────────

export type QueuedOperationType =
  | 'submit_report'
  | 'upvote_report'
  | 'update_crowd_level';

export interface QueuedOperation {
  id: string;
  type: QueuedOperationType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
}

export interface SyncQueueStatus {
  pending: number;
  lastFlushAt: number | null;
  isOnline: boolean;
  isFlushing: boolean;
}

// ── Module-level state ────────────────────────────────────────────────────

let _isOnline = true;
let _isFlushing = false;
let _lastFlushAt: number | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

const _operationHandlers = new Map<
  QueuedOperationType,
  (payload: Record<string, unknown>) => Promise<boolean>
>();

const _statusListeners: Array<(status: SyncQueueStatus) => void> = [];

// ── Utilities ─────────────────────────────────────────────────────────────

function _generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ── Queue persistence ─────────────────────────────────────────────────────

export async function getQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedOperation[];
    // Prune operations that have exhausted their retry budget
    return parsed.filter((op) => op.attempts < MAX_ATTEMPTS);
  } catch {
    return [];
  }
}

async function _persistQueue(ops: QueuedOperation[]): Promise<void> {
  try {
    const pruned = ops
      .filter((op) => op.attempts < MAX_ATTEMPTS)
      .slice(0, MAX_QUEUE_SIZE);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pruned));
  } catch {
    // Silent — queue is best-effort
  }
}

// ── Notify status listeners ───────────────────────────────────────────────

async function _notifyListeners(): Promise<void> {
  try {
    const queue = await getQueue();
    const status: SyncQueueStatus = {
      pending: queue.length,
      lastFlushAt: _lastFlushAt,
      isOnline: _isOnline,
      isFlushing: _isFlushing,
    };
    for (const listener of [..._statusListeners]) {
      try {
        listener(status);
      } catch {
        // Never let a listener crash the queue
      }
    }
  } catch {
    // Silent
  }
}

// ── Enqueue an operation ──────────────────────────────────────────────────

export async function enqueueOperation(
  type: QueuedOperationType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const queue = await getQueue();

    // Deduplicate upvotes: same reportId + userId should only be queued once
    if (type === 'upvote_report') {
      const isDuplicate = queue.some(
        (q) =>
          q.type === 'upvote_report' &&
          q.payload.reportId === payload.reportId &&
          q.payload.userId === payload.userId,
      );
      if (isDuplicate) return;
    }

    const op: QueuedOperation = {
      id: _generateId(),
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };

    queue.push(op);
    await _persistQueue(queue);
    void _notifyListeners();

    // If already online, schedule an immediate flush
    if (_isOnline && !_isFlushing) {
      _scheduleFlush();
    }
  } catch {
    // Silent — enqueue is best-effort; local save already succeeded
  }
}

// ── Register a per-type operation handler ─────────────────────────────────

export function registerOperationHandler(
  type: QueuedOperationType,
  handler: (payload: Record<string, unknown>) => Promise<boolean>,
): void {
  _operationHandlers.set(type, handler);
}

// ── Debounced flush scheduler ─────────────────────────────────────────────

function _scheduleFlush(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushQueue();
  }, FLUSH_DEBOUNCE_MS);
}

// ── Flush: process all queued operations ──────────────────────────────────

export async function flushQueue(): Promise<void> {
  if (_isFlushing) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  _isFlushing = true;
  void _notifyListeners();

  const remaining: QueuedOperation[] = [];

  for (const op of queue) {
    const handler = _operationHandlers.get(op.type);

    if (!handler) {
      // Handler not yet registered — keep for a later flush
      remaining.push(op);
      continue;
    }

    try {
      const success = await handler(op.payload);
      if (!success) {
        // Handler reported failure — increment attempt count and retain
        remaining.push({ ...op, attempts: op.attempts + 1, lastAttempt: Date.now() });
      }
      // success === true → operation completed, drop from queue
    } catch {
      remaining.push({ ...op, attempts: op.attempts + 1, lastAttempt: Date.now() });
    }
  }

  await _persistQueue(remaining);
  _lastFlushAt = Date.now();
  _isFlushing = false;
  void _notifyListeners();
}

// ── Subscribe to queue status changes ────────────────────────────────────

export function subscribeSyncStatus(
  listener: (status: SyncQueueStatus) => void,
): () => void {
  _statusListeners.push(listener);
  void _notifyListeners(); // emit current state immediately
  return () => {
    const idx = _statusListeners.indexOf(listener);
    if (idx !== -1) _statusListeners.splice(idx, 1);
  };
}

export async function getSyncQueueStatus(): Promise<SyncQueueStatus> {
  const queue = await getQueue();
  return {
    pending: queue.length,
    lastFlushAt: _lastFlushAt,
    isOnline: _isOnline,
    isFlushing: _isFlushing,
  };
}

// ── Online / Offline event handlers ──────────────────────────────────────

function _handleOnline(): void {
  _isOnline = true;
  void _notifyListeners();
  _scheduleFlush(); // flush any queued offline operations
}

function _handleOffline(): void {
  _isOnline = false;
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  void _notifyListeners();
}

// ── Service Worker → client message handler (Background Sync API) ─────────

function _initSWMessageListener(): void {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker
  ) return;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if ((event.data as { type?: string })?.type === 'FLUSH_SYNC_QUEUE') {
      void flushQueue();
    }
  });
}

// ── Register Background Sync tag with the service worker ─────────────────

async function _registerBGSync(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return;

    // Background Sync API — best-effort; falls back to online-event listener
    const registration = reg as unknown as {
      sync?: { register(tag: string): Promise<void> };
    };
    if (registration.sync) {
      await registration.sync.register('metroride-sync-queue');
    }
  } catch {
    // Background Sync API not available in this browser — online event is used instead
  }
}

// ── Start the sync queue listener ─────────────────────────────────────────

export function startSyncQueueListener(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    _isOnline = navigator.onLine;
    window.addEventListener('online', _handleOnline);
    window.addEventListener('offline', _handleOffline);
    _initSWMessageListener();
    void _registerBGSync();

    // Flush any operations that were queued during a previous offline session
    if (_isOnline) {
      _scheduleFlush();
    }
  } else {
    // Native: assume online and attempt a flush on startup
    _isOnline = true;
    _scheduleFlush();
  }
}

// ── Stop the sync queue listener ──────────────────────────────────────────

export function stopSyncQueueListener(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.removeEventListener('online', _handleOnline);
    window.removeEventListener('offline', _handleOffline);
  }
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
}
