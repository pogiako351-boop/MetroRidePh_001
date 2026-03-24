/**
 * MetroRide PH — Neon Onyx Vault
 * High-security admin PIN entry modal with cyberpunk aesthetic.
 * Features glassmorphic overlay, numeric keypad, shiver/glitch animations,
 * lockout protection, haptic feedback, and Supabase audit logging.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated as RNAnimated,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, hapticHeavy, hapticSuccess, hapticError } from '@/utils/haptics';
import { supabase } from '@/utils/supabase';

// ── Config ─────────────────────────────────────────────────────────────────
const ADMIN_PIN = (process.env.EXPO_PUBLIC_ADMIN_PIN || '2026').trim();
const PIN_LENGTH = ADMIN_PIN.length;
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

// ── Fonts ──────────────────────────────────────────────────────────────────
const MONO_FONT = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  web: 'Courier New, monospace',
  default: 'Courier New',
});

// ── Audit logger ───────────────────────────────────────────────────────────
async function logAuditEvent(
  eventType: 'success' | 'failure' | 'lockout_triggered',
  attemptCount: number,
): Promise<void> {
  try {
    if (!supabase) return;
    await supabase.from('vault_audit_log').insert({
      event_type: eventType,
      platform: Platform.OS,
      attempt_count: attemptCount,
      details: {
        timestamp: new Date().toISOString(),
        pin_length: PIN_LENGTH,
      },
    });
  } catch {
    // Silent — audit logging must never interrupt the auth flow
  }
}

// ── Web glass style ────────────────────────────────────────────────────────
const WEB_BLUR_STYLE = {
  backgroundColor: 'rgba(5, 5, 7, 0.97)',
  backdropFilter: 'blur(32px) saturate(160%)',
  WebkitBackdropFilter: 'blur(32px) saturate(160%)',
} as unknown as object;

// ── Types ──────────────────────────────────────────────────────────────────
export interface NeonOnyxVaultProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

type VaultPhase = 'idle' | 'scanning' | 'error' | 'locked' | 'success';

// ── Component ──────────────────────────────────────────────────────────────
export default function NeonOnyxVault({
  visible,
  title = 'NEON ONYX VAULT',
  subtitle = '// RESTRICTED ACCESS LAYER //',
  onSuccess,
  onCancel,
}: NeonOnyxVaultProps) {
  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<VaultPhase>('idle');
  const [failCount, setFailCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Animations ─────────────────────────────────────────────────────────
  const shiverAnim = useRef(new RNAnimated.Value(0)).current;
  const glitchOpacity = useRef(new RNAnimated.Value(1)).current;
  const scanPulse = useRef(new RNAnimated.Value(0.4)).current;
  const errorBorder = useRef(new RNAnimated.Value(0)).current;
  const cardScale = useRef(new RNAnimated.Value(0.95)).current;
  const cardOpacity = useRef(new RNAnimated.Value(0)).current;
  const lockIconSpin = useRef(new RNAnimated.Value(0)).current;

  // Card entrance animation
  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.spring(cardScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        RNAnimated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      cardScale.setValue(0.95);
      cardOpacity.setValue(0);
    }
  }, [visible, cardScale, cardOpacity]);

  // Scanning pulse animation
  useEffect(() => {
    if (phase === 'scanning') {
      const anim = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(scanPulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          RNAnimated.timing(scanPulse, {
            toValue: 0.2,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      scanPulse.setValue(phase === 'error' ? 1 : 0.6);
    }
  }, [phase, scanPulse]);

  // Lock icon spin on scanning
  useEffect(() => {
    if (phase === 'scanning') {
      RNAnimated.loop(
        RNAnimated.timing(lockIconSpin, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      lockIconSpin.setValue(0);
    }
  }, [phase, lockIconSpin]);

  // Lockout countdown
  useEffect(() => {
    if (!isLocked) return;
    setLockoutSecondsLeft(LOCKOUT_SECONDS);
    const interval = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLocked(false);
          setFailCount(0);
          setPhase('idle');
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  // ── Shiver animation (wrong PIN) ───────────────────────────────────────
  const triggerShiver = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(shiverAnim, { toValue: -14, duration: 50, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: 14, duration: 50, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: -10, duration: 45, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: 10, duration: 45, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: -3, duration: 35, useNativeDriver: true }),
      RNAnimated.timing(shiverAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
  }, [shiverAnim]);

  // ── Error border flash ────────────────────────────────────────────────
  const triggerErrorBorder = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(errorBorder, { toValue: 1, duration: 80, useNativeDriver: false }),
      RNAnimated.timing(errorBorder, { toValue: 0.7, duration: 120, useNativeDriver: false }),
      RNAnimated.timing(errorBorder, { toValue: 1, duration: 80, useNativeDriver: false }),
      RNAnimated.timing(errorBorder, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]).start();
  }, [errorBorder]);

  // ── Glitch-to-clear (success) ─────────────────────────────────────────
  const triggerGlitch = useCallback(
    (callback: () => void) => {
      RNAnimated.sequence([
        RNAnimated.timing(glitchOpacity, { toValue: 0.1, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(glitchOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(glitchOpacity, { toValue: 0.05, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(glitchOpacity, { toValue: 0.9, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(glitchOpacity, { toValue: 0.2, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(glitchOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => callback());
    },
    [glitchOpacity],
  );

  // ── PIN verification ───────────────────────────────────────────────────
  const verifyPin = useCallback(
    async (enteredPin: string) => {
      if (isLocked || phase === 'scanning' || phase === 'success') return;

      setPhase('scanning');
      setErrorMsg('');

      // Brief "scanning" delay for UX feedback
      await new Promise((r) => setTimeout(r, 700));

      if (enteredPin === ADMIN_PIN) {
        // ── SUCCESS ──
        setPhase('success');
        hapticSuccess();
        logAuditEvent('success', failCount + 1);
        triggerGlitch(() => {
          onSuccess();
          // Reset for next use
          setTimeout(() => {
            setPin('');
            setPhase('idle');
            setFailCount(0);
            setErrorMsg('');
          }, 400);
        });
      } else {
        // ── FAILURE ──
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);
        setPhase('error');
        hapticError();
        triggerShiver();
        triggerErrorBorder();
        logAuditEvent('failure', newFailCount);

        if (newFailCount >= MAX_ATTEMPTS) {
          // Trigger lockout
          logAuditEvent('lockout_triggered', newFailCount);
          setErrorMsg('TOO MANY ATTEMPTS — LOCKED');
          setIsLocked(true);
          setPhase('locked');
        } else {
          const remaining = MAX_ATTEMPTS - newFailCount;
          setErrorMsg(`INVALID CODE · ${remaining} attempt${remaining === 1 ? '' : 's'} left`);
          setTimeout(() => {
            setPhase('idle');
            setErrorMsg('');
          }, 1800);
        }
        setPin('');
      }
    },
    [
      isLocked,
      phase,
      failCount,
      onSuccess,
      triggerShiver,
      triggerErrorBorder,
      triggerGlitch,
    ],
  );

  // ── Keypad handlers ────────────────────────────────────────────────────
  const handleDigit = useCallback(
    (digit: string) => {
      if (isLocked || phase === 'scanning' || phase === 'success') return;
      hapticLight();
      setPhase('idle');
      setErrorMsg('');
      setPin((prev) => {
        const next = prev + digit;
        if (next.length === PIN_LENGTH) {
          // Auto-submit
          verifyPin(next);
        }
        return next.length <= PIN_LENGTH ? next : prev;
      });
    },
    [isLocked, phase, verifyPin],
  );

  const handleBackspace = useCallback(() => {
    if (isLocked || phase === 'scanning' || phase === 'success') return;
    hapticLight();
    setPin((prev) => prev.slice(0, -1));
    if (phase === 'error') setPhase('idle');
  }, [isLocked, phase]);

  const handleManualSubmit = useCallback(() => {
    if (pin.length === 0 || isLocked || phase === 'scanning') return;
    hapticHeavy();
    verifyPin(pin);
  }, [pin, isLocked, phase, verifyPin]);

  // ── Derived state ──────────────────────────────────────────────────────
  const borderColor = errorBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(64,224,255,0.22)', 'rgba(255,68,68,0.85)'],
  });

  const lockSpinRotate = lockIconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isInteractive = !isLocked && phase !== 'scanning' && phase !== 'success';

  // Status text
  let statusText = '';
  let statusColor = '#40E0FF';
  if (phase === 'scanning') {
    statusText = 'SCANNING...';
    statusColor = '#40E0FF';
  } else if (phase === 'error' && errorMsg) {
    statusText = errorMsg;
    statusColor = '#FF4444';
  } else if (phase === 'locked') {
    statusText = `SYSTEM LOCKED · ${lockoutSecondsLeft}s`;
    statusColor = '#FF4444';
  } else if (phase === 'success') {
    statusText = 'ACCESS GRANTED';
    statusColor = '#22C55E';
  } else if (pin.length > 0) {
    statusText = `${pin.length}/${PIN_LENGTH}`;
    statusColor = 'rgba(64,224,255,0.5)';
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Blur overlay */}
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, WEB_BLUR_STYLE as never]} />
        ) : (
          <BlurView
            intensity={60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.onyxLayer} />
      </View>

      {/* Centered container */}
      <View style={styles.centeredContainer}>
        {/* Card with shiver + glitch animations */}
        <RNAnimated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: shiverAnim },
                { scale: cardScale },
              ],
              opacity: RNAnimated.multiply(glitchOpacity, cardOpacity),
            },
          ]}
        >
          {/* Animated border via wrapper */}
          <RNAnimated.View
            style={[StyleSheet.absoluteFill, styles.cardBorderAnim, { borderColor }]}
            pointerEvents="none"
          />

          {/* Lock icon */}
          <View style={styles.iconRow}>
            <RNAnimated.View
              style={[
                styles.iconBg,
                phase === 'success' && styles.iconBgSuccess,
                phase === 'error' && styles.iconBgError,
                phase === 'locked' && styles.iconBgLocked,
                phase === 'scanning' && { transform: [{ rotate: lockSpinRotate }] },
              ]}
            >
              <Ionicons
                name={
                  phase === 'success'
                    ? 'checkmark-circle'
                    : phase === 'error' || phase === 'locked'
                    ? 'lock-closed'
                    : 'shield-checkmark'
                }
                size={34}
                color={
                  phase === 'success'
                    ? '#22C55E'
                    : phase === 'error' || phase === 'locked'
                    ? '#FF4444'
                    : '#40E0FF'
                }
              />
            </RNAnimated.View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* PIN dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    filled && styles.dotFilled,
                    phase === 'error' && filled && styles.dotError,
                    phase === 'success' && styles.dotSuccess,
                  ]}
                />
              );
            })}
          </View>

          {/* Status line */}
          <View style={styles.statusRow}>
            {phase === 'scanning' ? (
              <RNAnimated.Text style={[styles.statusText, { color: statusColor, opacity: scanPulse }]}>
                {statusText}
              </RNAnimated.Text>
            ) : (
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
            )}
          </View>

          {/* Numeric Keypad */}
          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.keyBtn, !isInteractive && styles.keyBtnDisabled]}
                onPress={() => handleDigit(d)}
                activeOpacity={0.7}
                disabled={!isInteractive}
              >
                <Text style={[styles.keyText, !isInteractive && styles.keyTextDisabled]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Bottom row: backspace, 0, confirm */}
            <TouchableOpacity
              style={[styles.keyBtn, styles.keyBtnAux, !isInteractive && styles.keyBtnDisabled]}
              onPress={handleBackspace}
              activeOpacity={0.7}
              disabled={!isInteractive}
            >
              <Ionicons
                name="backspace-outline"
                size={20}
                color={isInteractive ? '#40E0FF' : 'rgba(64,224,255,0.3)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyBtn, !isInteractive && styles.keyBtnDisabled]}
              onPress={() => handleDigit('0')}
              activeOpacity={0.7}
              disabled={!isInteractive}
            >
              <Text style={[styles.keyText, !isInteractive && styles.keyTextDisabled]}>
                0
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.keyBtn,
                styles.keyBtnConfirm,
                (pin.length === 0 || !isInteractive) && styles.keyBtnDisabled,
              ]}
              onPress={handleManualSubmit}
              activeOpacity={0.7}
              disabled={pin.length === 0 || !isInteractive}
            >
              <Ionicons
                name="return-down-forward-outline"
                size={20}
                color={
                  pin.length > 0 && isInteractive
                    ? '#0A0A0A'
                    : 'rgba(64,224,255,0.3)'
                }
              />
            </TouchableOpacity>
          </View>

          {/* Cancel button */}
          {!!onCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                hapticLight();
                onCancel();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>← EXIT VAULT</Text>
            </TouchableOpacity>
          )}

          {/* Security footer */}
          <Text style={styles.footerText}>
            {'// METRORIDE PH · SECURED LAYER · v2026 //'}
          </Text>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 40, 360);

const styles = StyleSheet.create({
  onyxLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 7, 0.88)',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.22)',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#40E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
  },
  cardBorderAnim: {
    borderRadius: 20,
    borderWidth: 1,
    pointerEvents: 'none',
  } as never,
  iconRow: {
    marginBottom: 16,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(64,224,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(64,224,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  iconBgError: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderColor: 'rgba(255,68,68,0.4)',
  },
  iconBgLocked: {
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderColor: 'rgba(255,68,68,0.5)',
  },
  title: {
    fontFamily: MONO_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: 'rgba(64,224,255,0.5)',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(64,224,255,0.2)',
  },
  dotFilled: {
    backgroundColor: '#40E0FF',
    borderColor: '#40E0FF',
    shadowColor: '#40E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
  },
  dotError: {
    backgroundColor: '#FF4444',
    borderColor: '#FF4444',
    shadowColor: '#FF4444',
    shadowOpacity: 0.7,
  },
  dotSuccess: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 0.7,
  },
  statusRow: {
    height: 20,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    color: '#40E0FF',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: CARD_W - 56,
    gap: 10,
    justifyContent: 'center',
    marginBottom: 24,
  },
  keyBtn: {
    width: (CARD_W - 56 - 20) / 3,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnAux: {
    backgroundColor: 'rgba(64,224,255,0.04)',
  },
  keyBtnConfirm: {
    backgroundColor: '#40E0FF',
    borderColor: '#40E0FF',
  },
  keyBtnDisabled: {
    opacity: 0.35,
  },
  keyText: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  keyTextDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cancelText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
  },
  footerText: {
    fontFamily: MONO_FONT,
    fontSize: 8,
    color: 'rgba(64,224,255,0.18)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
