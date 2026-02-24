import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Animated as RNAnimated,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { hapticLight, hapticSuccess, hapticWarning, hapticMedium } from '@/utils/haptics';

const KEYS = {
  BEEP_BALANCE: '@metroride_beep_balance',
  BEEP_CARD_ID: '@metroride_beep_card_id',
  LOW_BALANCE_ALERT: '@metroride_low_balance_alert',
  LOW_BALANCE_THRESHOLD: '@metroride_low_balance_threshold',
  BEEP_TRANSACTIONS: '@metroride_beep_transactions',
};

interface BeepTransaction {
  id: string;
  type: 'load' | 'deduct';
  amount: number;
  label: string;
  timestamp: number;
}

const PRESET_LOADS = [100, 200, 300, 500];

export default function BeepCardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [cardId, setCardId] = useState('');
  const [lowBalanceAlert, setLowBalanceAlert] = useState(true);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(50);
  const [transactions, setTransactions] = useState<BeepTransaction[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductLabel, setDeductLabel] = useState('Train fare');
  const [cardFlipped, setCardFlipped] = useState(false);
  const flipAnim = useRef(new RNAnimated.Value(0)).current;
  const balanceAnim = useRef(new RNAnimated.Value(1)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    loadData();
    // Start glow animation
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        RNAnimated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const [b, id, alert, threshold, txns] = await Promise.all([
        AsyncStorage.getItem(KEYS.BEEP_BALANCE),
        AsyncStorage.getItem(KEYS.BEEP_CARD_ID),
        AsyncStorage.getItem(KEYS.LOW_BALANCE_ALERT),
        AsyncStorage.getItem(KEYS.LOW_BALANCE_THRESHOLD),
        AsyncStorage.getItem(KEYS.BEEP_TRANSACTIONS),
      ]);
      if (b !== null) setBalance(parseFloat(b));
      if (id) setCardId(id);
      if (alert !== null) setLowBalanceAlert(JSON.parse(alert));
      if (threshold) setLowBalanceThreshold(parseFloat(threshold));
      if (txns) setTransactions(JSON.parse(txns));
    } catch {}
  };

  const saveBalance = async (newBalance: number) => {
    await AsyncStorage.setItem(KEYS.BEEP_BALANCE, newBalance.toString());
  };

  const saveCardId = async (id: string) => {
    await AsyncStorage.setItem(KEYS.BEEP_CARD_ID, id);
  };

  const saveTransaction = async (txn: BeepTransaction) => {
    const updated = [txn, ...transactions].slice(0, 20);
    setTransactions(updated);
    await AsyncStorage.setItem(KEYS.BEEP_TRANSACTIONS, JSON.stringify(updated));
  };

  const flipCard = useCallback(() => {
    hapticLight();
    const toValue = cardFlipped ? 0 : 1;
    RNAnimated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setCardFlipped(!cardFlipped);
  }, [cardFlipped, flipAnim]);

  const animateBalance = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(balanceAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
      RNAnimated.spring(balanceAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [balanceAnim]);

  const handleLoad = useCallback(async () => {
    const amt = parseFloat(loadAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (amt > 10000) {
      Alert.alert('Too Large', 'Maximum load is ₱10,000.');
      return;
    }
    hapticSuccess();
    const newBalance = balance + amt;
    setBalance(newBalance);
    await saveBalance(newBalance);
    await saveTransaction({
      id: Date.now().toString(),
      type: 'load',
      amount: amt,
      label: 'Card Load',
      timestamp: Date.now(),
    });
    animateBalance();
    setLoadAmount('');
    setShowLoadModal(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAmount, balance, animateBalance]);

  const handleDeduct = useCallback(async () => {
    const amt = parseFloat(deductAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (amt > balance) {
      Alert.alert('Insufficient Balance', `Your current balance is ₱${balance.toFixed(2)}.`);
      hapticWarning();
      return;
    }
    hapticMedium();
    const newBalance = balance - amt;
    setBalance(newBalance);
    await saveBalance(newBalance);
    await saveTransaction({
      id: Date.now().toString(),
      type: 'deduct',
      amount: amt,
      label: deductLabel || 'Train fare',
      timestamp: Date.now(),
    });
    if (newBalance <= lowBalanceThreshold && lowBalanceAlert) {
      hapticWarning();
      setTimeout(() => {
        Alert.alert(
          '⚠️ Low Balance Alert',
          `Your Beep Card balance is ₱${newBalance.toFixed(2)} — below the ₱${lowBalanceThreshold} threshold. Consider loading up!`
        );
      }, 500);
    }
    animateBalance();
    setDeductAmount('');
    setDeductLabel('Train fare');
    setShowDeductModal(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deductAmount, deductLabel, balance, lowBalanceThreshold, lowBalanceAlert, animateBalance]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  const isLowBalance = balance <= lowBalanceThreshold && balance > 0;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Beep Card Manager</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

        {/* Digital Card */}
        <Animated.View entering={ZoomIn.duration(600).delay(100)}>
          <Pressable onPress={flipCard}>
            <View style={styles.cardContainer}>
              {/* Front Face */}
              <RNAnimated.View style={[styles.cardFace, styles.cardFront, { transform: [{ rotateY: frontRotate }] }]}>
                {/* Glow */}
                <RNAnimated.View style={[styles.cardGlow, { opacity: glowOpacity }]} />

                {/* Card content */}
                <View style={styles.cardTop}>
                  <View style={styles.beepLogo}>
                    <Text style={styles.beepLogoText}>beep.</Text>
                  </View>
                  <View style={styles.cardChip} />
                </View>

                <View style={styles.cardMiddle}>
                  <RNAnimated.Text
                    style={[styles.cardBalance, { transform: [{ scale: balanceAnim }] }]}
                  >
                    ₱{balance.toFixed(2)}
                  </RNAnimated.Text>
                  <Text style={styles.cardBalanceLabel}>Available Balance</Text>
                </View>

                {isLowBalance && (
                  <View style={styles.lowBalanceBadge}>
                    <Ionicons name="warning" size={12} color={Colors.warning} />
                    <Text style={styles.lowBalanceText}>Low Balance</Text>
                  </View>
                )}

                <View style={styles.cardBottom}>
                  <Text style={styles.cardNetwork}>BEEP • Rapid Transit Network</Text>
                  <Text style={styles.cardId}>
                    {cardId ? `••• ${cardId.slice(-4)}` : 'Tap to flip →'}
                  </Text>
                </View>

                {/* Decorative circles */}
                <View style={styles.deco1} />
                <View style={styles.deco2} />
              </RNAnimated.View>

              {/* Back Face */}
              <RNAnimated.View style={[styles.cardFace, styles.cardBack, { transform: [{ rotateY: backRotate }] }]}>
                <View style={styles.cardMagStripe} />
                <View style={styles.cardBackContent}>
                  <Text style={styles.cardBackLabel}>Card Number</Text>
                  <TextInput
                    style={styles.cardIdInput}
                    value={cardId}
                    onChangeText={(v) => {
                      setCardId(v);
                      saveCardId(v);
                    }}
                    placeholder="Enter card ID..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    maxLength={16}
                  />
                  <Text style={styles.cardBackHint}>Tap card to flip back</Text>
                </View>
              </RNAnimated.View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.actionRow}>
          <Pressable
            onPress={() => { hapticLight(); setShowLoadModal(true); }}
            style={[styles.actionBtn, styles.loadBtn]}
          >
            <Ionicons name="add-circle" size={22} color="#FFF" />
            <Text style={styles.actionBtnText}>Load Card</Text>
          </Pressable>
          <Pressable
            onPress={() => { hapticLight(); setShowDeductModal(true); }}
            style={[styles.actionBtn, styles.deductBtn]}
          >
            <Ionicons name="remove-circle" size={22} color="#FFF" />
            <Text style={styles.actionBtnText}>Log Fare</Text>
          </Pressable>
        </Animated.View>

        {/* Low Balance Alert Setting */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.amberLight }]}>
              <Ionicons name="notifications" size={18} color={Colors.amber} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Low Balance Alert</Text>
              <Text style={styles.settingDesc}>Notify when below ₱{lowBalanceThreshold}</Text>
            </View>
            <Switch
              value={lowBalanceAlert}
              onValueChange={(v) => {
                hapticLight();
                setLowBalanceAlert(v);
                AsyncStorage.setItem(KEYS.LOW_BALANCE_ALERT, JSON.stringify(v));
              }}
              trackColor={{ false: Colors.border, true: Colors.amber }}
              thumbColor={Colors.surface}
            />
          </View>

          {lowBalanceAlert && (
            <View style={styles.thresholdRow}>
              <Text style={styles.thresholdLabel}>Alert threshold: ₱{lowBalanceThreshold}</Text>
              <View style={styles.thresholdBtns}>
                {[20, 50, 100, 150].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => {
                      hapticLight();
                      setLowBalanceThreshold(t);
                      AsyncStorage.setItem(KEYS.LOW_BALANCE_THRESHOLD, t.toString());
                    }}
                    style={[styles.thresholdChip, lowBalanceThreshold === t && styles.thresholdChipActive]}
                  >
                    <Text style={[styles.thresholdChipText, lowBalanceThreshold === t && styles.thresholdChipTextActive]}>
                      ₱{t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Transaction History */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="receipt-outline" size={18} color={Colors.text} />
            <Text style={styles.historyTitle}>Transaction History</Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubText}>Load or log fares to track your spending</Text>
            </View>
          ) : (
            transactions.map((txn, idx) => (
              <Animated.View
                key={txn.id}
                entering={FadeInDown.duration(300).delay(idx * 50)}
                style={[styles.txnRow, idx < transactions.length - 1 && styles.txnBorder]}
              >
                <View style={[styles.txnIcon, { backgroundColor: txn.type === 'load' ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Ionicons
                    name={txn.type === 'load' ? 'add-circle' : 'train'}
                    size={18}
                    color={txn.type === 'load' ? Colors.success : Colors.error}
                  />
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnLabel}>{txn.label}</Text>
                  <Text style={styles.txnTime}>{formatTime(txn.timestamp)}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'load' ? Colors.success : Colors.error }]}>
                  {txn.type === 'load' ? '+' : '-'}₱{txn.amount.toFixed(2)}
                </Text>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* Load Modal */}
      <Modal visible={showLoadModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLoadModal(false)}>
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalCard}>
            <Text style={styles.modalTitle}>💳 Load Card</Text>
            <Text style={styles.modalCurrent}>Current: ₱{balance.toFixed(2)}</Text>

            <View style={styles.presetRow}>
              {PRESET_LOADS.map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => { hapticLight(); setLoadAmount(amt.toString()); }}
                  style={[styles.presetBtn, loadAmount === amt.toString() && styles.presetBtnActive]}
                >
                  <Text style={[styles.presetText, loadAmount === amt.toString() && styles.presetTextActive]}>
                    ₱{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.amountInput}>
              <Text style={styles.amountCurrency}>₱</Text>
              <TextInput
                style={styles.amountField}
                value={loadAmount}
                onChangeText={setLoadAmount}
                placeholder="Custom amount"
                keyboardType="numeric"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowLoadModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleLoad} style={styles.confirmBtn}>
                <Text style={styles.confirmText}>Load ₱{loadAmount || '0'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Deduct Modal */}
      <Modal visible={showDeductModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeductModal(false)}>
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalCard}>
            <Text style={styles.modalTitle}>🚇 Log Fare</Text>
            <Text style={styles.modalCurrent}>Current: ₱{balance.toFixed(2)}</Text>

            <View style={styles.quickFares}>
              {[{ label: 'MRT-3 Short', amt: 13 }, { label: 'MRT-3 Long', amt: 28 }, { label: 'LRT-1', amt: 20 }, { label: 'LRT-2', amt: 15 }].map((f) => (
                <Pressable
                  key={f.label}
                  onPress={() => { hapticLight(); setDeductAmount(f.amt.toString()); setDeductLabel(f.label); }}
                  style={[styles.fareChip, deductLabel === f.label && styles.fareChipActive]}
                >
                  <Text style={[styles.fareChipText, deductLabel === f.label && styles.fareChipTextActive]}>
                    {f.label}{'\n'}₱{f.amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.labelInput}
              value={deductLabel}
              onChangeText={setDeductLabel}
              placeholder="Fare description..."
              placeholderTextColor={Colors.textTertiary}
            />

            <View style={styles.amountInput}>
              <Text style={styles.amountCurrency}>₱</Text>
              <TextInput
                style={styles.amountField}
                value={deductAmount}
                onChangeText={setDeductAmount}
                placeholder="Amount"
                keyboardType="numeric"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowDeductModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDeduct} style={[styles.confirmBtn, { backgroundColor: Colors.error }]}>
                <Text style={styles.confirmText}>Deduct ₱{deductAmount || '0'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  // Digital Card
  cardContainer: {
    height: 200,
    position: 'relative',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  cardFront: {
    backgroundColor: '#1A237E',
    ...Shadow.lg,
  },
  cardBack: {
    backgroundColor: '#0D47A1',
    ...Shadow.lg,
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primary,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beepLogo: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  beepLogoText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    color: '#FFF',
    letterSpacing: -0.5,
  },
  cardChip: {
    width: 36,
    height: 28,
    backgroundColor: '#F4B400',
    borderRadius: 6,
    opacity: 0.9,
  },
  cardMiddle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBalance: {
    fontSize: 38,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  cardBalanceLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  lowBalanceBadge: {
    position: 'absolute',
    top: 56,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning + '33',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.warning + '66',
  },
  lowBalanceText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.semibold,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardNetwork: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardId: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  deco1: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  deco2: {
    position: 'absolute',
    bottom: -60,
    left: 60,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cardMagStripe: {
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    marginTop: -Spacing.xl,
    marginHorizontal: -Spacing.xl,
    marginBottom: Spacing.lg,
  },
  cardBackContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardBackLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardIdInput: {
    fontSize: FontSize.xl,
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 4,
    width: '100%',
  },
  cardBackHint: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.3)',
    marginTop: Spacing.sm,
  },
  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadow.md,
  },
  loadBtn: {
    backgroundColor: Colors.success,
  },
  deductBtn: {
    backgroundColor: Colors.error,
  },
  actionBtnText: {
    fontSize: FontSize.lg,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  // Settings
  settingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  settingDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  thresholdRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  thresholdLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  thresholdBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  thresholdChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.amber,
    backgroundColor: Colors.background,
  },
  thresholdChipActive: {
    backgroundColor: Colors.amber,
  },
  thresholdChipText: {
    fontSize: FontSize.sm,
    color: Colors.amber,
    fontWeight: FontWeight.medium,
  },
  thresholdChipTextActive: {
    color: '#FFF',
  },
  // History
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  historyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  emptySubText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  txnBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnInfo: {
    flex: 1,
  },
  txnLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  txnTime: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  modalCurrent: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.success,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: Colors.success,
  },
  presetText: {
    fontSize: FontSize.md,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
  },
  presetTextActive: {
    color: '#FFF',
  },
  quickFares: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  fareChip: {
    flex: 1,
    minWidth: '40%',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  fareChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  fareChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  fareChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  labelInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amountCurrency: {
    fontSize: FontSize.xl,
    color: Colors.text,
    fontWeight: FontWeight.bold,
  },
  amountField: {
    flex: 1,
    fontSize: FontSize.xl,
    color: Colors.text,
    fontWeight: FontWeight.bold,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
    alignItems: 'center',
    ...Shadow.md,
  },
  confirmText: {
    fontSize: FontSize.md,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
});
