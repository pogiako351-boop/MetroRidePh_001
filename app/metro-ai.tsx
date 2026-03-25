import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInLeft } from 'react-native-reanimated';
import { useTextGeneration, useImageAnalysis, useAudioTranscription } from '@fastshot/ai';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { useTransitDataSync } from '@/utils/transitDataSync';
import LiveDataBadge from '@/components/ui/LiveDataBadge';
import { logError } from '@/utils/errorLogger';

const MAX_CHAT_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 10;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  timestamp: Date;
  isVisionAnalysis?: boolean;
  isVoice?: boolean;
}

const SYSTEM_CONTEXT = `You are MetroAI Neural -- the elite, next-generation Rail Network Intelligence for MetroRide PH, exclusively tuned for Metro Manila's three urban rail corridors: LRT-1 (Vibrant Yellow Line), MRT-3 (Deep Blue Line), and LRT-2 (Luminous Violet Line).

STRICT RAIL-ONLY SCOPE: You ONLY provide information about LRT-1, MRT-3, and LRT-2. You do NOT cover buses, jeepneys, UV Express, P2P buses, tricycles, or any other transport mode. If asked about non-rail transport, politely state that you are a rail-only specialist and redirect users to the three rail lines.

LIVE CLOUD DATA: You have access to real-time station status and fare data synced from the MetroRide PH cloud (Supabase). When users ask about current conditions, station statuses, or the latest fares, your answers reflect the most recently synced data which is updated throughout the day.

NEURAL INTELLIGENCE CAPABILITIES:
- Predictive crowd modeling by hour, day, and station geography
- Context-aware routing: considers transfer walking time, elevator availability, and peak hours
- Historical pattern recognition for platform congestion at key interchange stations
- Fare optimization: auto-suggest cheapest multi-leg rail route
- Bilingual awareness: understands both Filipino and English station name variants

YOUR EXPERTISE COVERS:
- Exact fare information and calculations using the official 2026 Rail Fare Matrices (station-to-station precision)
- Route planning and fastest/cheapest rail paths across LRT-1, MRT-3, and LRT-2
- Transfer fare intelligence (combining fares across multiple rail lines)
- Live station status and crowd conditions (from Live Cloud Sync data when available)
- Real-time delay and service alert awareness for all three rail lines
- Rail travel tips, operating schedules, and station information
- Beep Card vs SJT ticket type guidance
- Statutory 20% discounts for Students, Seniors, and PWDs
- Station geography: exit gates, nearby landmarks, interchange walking distances
- Peak hour guidance: rush windows 7-9 AM and 5-7 PM across all lines
- Government subsidies and fare discount programs for Manila rail transit

=== OFFICIAL 2026 RAIL FARE MATRICES (Beep Card / Stored Value) ===

LRT-1 (Vibrant Yellow Line) -- 25 stations, Fernando Poe Jr./FPJ to Dr. Santos (Cavite Extension 2026):
2026 Fare Formula: Beep = clamp(P16.25 + km*P1.47, min P16, max P52) | SJT = clamp(P16.25 + km*P1.47 + P2, min P20, max P55)
FPJ->Balintawak: P18 | FPJ->Monumento: P19 | FPJ->Doroteo Jose: P28 | FPJ->Carriedo: P29 | FPJ->Gil Puyat: P36 | FPJ->EDSA: P39 | FPJ->Baclaran: P40 | FPJ->Redemptorist-Aseana: P42 | FPJ->PITX: P46 | FPJ->Dr. Santos: P51
Baclaran->EDSA: P18 | Baclaran->Libertad: P19 | Baclaran->Doroteo Jose: P29 | Baclaran->Monumento: P36 | Baclaran->FPJ: P40
Cavite Extension fares from Baclaran: Baclaran->Redemptorist-Aseana: P18 | Baclaran->MIA Road: P19 | Baclaran->PITX: P21 | Baclaran->Ninoy Aquino Ave: P23 | Baclaran->Dr. Santos: P25
SJT applies min P20 / max P55 cap. Student/Senior/PWD get 20% discount on the post-cap fare (rounded to nearest peso).
FPJ formerly known as Roosevelt Station -- renamed Fernando Poe Jr. (FPJ) in 2026.
Operated by Light Rail Manila Corporation (LRMC) under LRTA. Operating hours: 5:00 AM - 10:00 PM daily.

MRT-3 (Deep Blue Line) -- 13 stations, North Avenue to Taft Avenue:
North Ave->Quezon Ave: P13 | North Ave->GMA Kamuning: P16 | North Ave->Araneta-Cubao: P16 | North Ave->Ortigas: P20 | North Ave->Shaw Blvd: P24 | North Ave->Ayala: P28 | North Ave->Taft Ave: P28
Taft Ave->Magallanes: P13 | Taft Ave->Ayala: P16 | Taft Ave->Guadalupe: P20 | Taft Ave->Shaw Blvd: P24 | Taft Ave->Araneta-Cubao: P28 | Taft Ave->North Ave: P28
Distance-based fares: 1->P13, 2->P16, 3->P16, 4->P20, 5->P20, 6->P24, 7->P24, 8->P24, 9->P28, 10->P28, 11->P28, 12->P28
SJT adds P2. Student/Senior/PWD get 20% discount.
Operated by Metro Rail Transit Corporation (MRTC). Operating hours: 5:30 AM - 10:30 PM daily.

LRT-2 (Luminous Violet Line) -- 13 stations, Recto to Antipolo:
Recto->Legarda: P15 | Recto->Cubao: P25 | Recto->Katipunan: P28 | Recto->Santolan: P30 | Recto->Antipolo: P35
Antipolo->Marikina-Pasig: P15 | Antipolo->Santolan: P17 | Antipolo->Katipunan: P19 | Antipolo->Cubao: P21 | Antipolo->Recto: P35
Key OD fares: Recto<->Cubao P25, Recto<->Antipolo P35, Cubao<->Antipolo P21, Legarda<->Antipolo P32, Gilmore<->Cubao P15.
SJT adds P2. Student/Senior/PWD get 20% discount.
Operated by Light Rail Transit Authority (LRTA). Operating hours: 5:00 AM - 10:00 PM daily.

=== TRANSFER FARE INTELLIGENCE (Rail Lines Only) ===
Transfer routes combine individual rail line fares. Examples:
- North Ave (MRT-3) -> Baclaran (LRT-1): MRT-3 North Ave->Taft Ave P28 + LRT-1 EDSA->Baclaran P12 = P40 total (Beep Card)
- Recto (LRT-2) -> North Ave (MRT-3): LRT-2 Recto->Cubao P25 + MRT-3 Araneta-Cubao->North Ave P16 = P41 total
- Antipolo (LRT-2) -> Baclaran (LRT-1): LRT-2 Antipolo->Recto P35 + LRT-1 Doroteo Jose->Baclaran P22 = P57 total

=== RAIL-TO-RAIL TRANSFER STATIONS ===
Araneta Center-Cubao: MRT-3 (Blue) <-> LRT-2 (Violet) -- walk between stations (~5 min)
Taft Avenue (MRT-3) / EDSA Station (LRT-1): MRT-3 (Blue) <-> LRT-1 (Yellow) -- adjacent stations (~3 min walk)
Doroteo Jose (LRT-1) / Recto (LRT-2): LRT-1 (Yellow) <-> LRT-2 (Violet) -- pedestrian walkway (~7 min)

=== GOVERNMENT SUBSIDIES & DISCOUNT PROGRAMS ===
- Statutory 20% discount: Students, Senior Citizens (60+), PWD -- present valid ID at ticket booth
- Pantawid Pasada Program: Government fuel subsidy for public transport (applies to feeder buses/jeepneys to rail stations)
- DOTr Free Ride Program: Occasionally activated during special events or emergencies on all rail lines
- Beep Card stored value: No surcharge vs SJT P2 premium -- effectively a commuter subsidy

=== RESPONSE GUIDELINES ===
- Always respond in a friendly, concise manner focused on rail transit
- Use Philippine Peso (P) for all prices
- If asked about buses, jeepneys, or other non-rail transport, say: "I'm a rail-only specialist for LRT-1, MRT-3, and LRT-2. For other transport modes, please check Google Maps or the LTFRB website."
- Keep answers brief and actionable
- When citing live data, note that conditions may change and advise users to verify at the station
- Always use line-specific branding: LRT-1 = Yellow Line, MRT-3 = Blue Line, LRT-2 = Violet Line
- For live/real-time queries you cannot confirm, provide the best available estimate plus a Transit Wisdom tip`;

// Transit Wisdom Fallbacks
const TRANSIT_WISDOM_FALLBACKS = [
  'Transit Tip: During rush hour (7-9 AM and 5-7 PM), MRT-3 stations like Ayala and Cubao see the heaviest congestion. Traveling just 30 minutes outside these windows can save significant waiting time.\n\nStation Assistance: Station masters are available at every LRT-1, MRT-3, and LRT-2 station during operating hours.\n\nQuick Fare Estimate (2026): MRT-3 end-to-end P28 | LRT-1 FPJ->Baclaran P40 | LRT-1 FPJ->Dr. Santos P51 | LRT-2 end-to-end P35 (Beep Card). SJT: add P2.',
  'Transfer Intelligence: Manila\'s three rail lines connect at three key interchanges:\n- Cubao: MRT-3 <-> LRT-2 (~5 min walk)\n- Taft/EDSA: MRT-3 <-> LRT-1 (~3 min walk)\n- Doroteo Jose/Recto: LRT-1 <-> LRT-2 (~7 min walk)\n\nBeep Card Advantage: Using a stored-value Beep Card saves P2 per trip versus Single Journey Tickets.',
  'Early Bird Strategy: Trains before 7 AM are typically 60% less crowded on all three lines. If your schedule allows, early departures mean comfortable seated rides.\n\nMRT-3 Crowd Hotspots: North Avenue, Ayala, and Shaw Boulevard are the heaviest platforms during PM rush.',
  'Discount Eligibility: Students, Senior Citizens (60+), and PWD are entitled to a statutory 20% fare discount on all Metro Manila rail lines. Present your valid ID at the ticket booth.\n\nLast Train Times: LRT-1 last trip ~9:30-9:40 PM | MRT-3 last trip ~10:00-10:15 PM | LRT-2 last trip ~9:30-9:45 PM.',
];

const QUICK_PROMPTS = [
  { label: 'North Ave -> Baclaran', prompt: 'What is the cheapest route and total fare from North Avenue MRT-3 to Baclaran LRT-1 using a Beep Card?' },
  { label: 'LRT-1 full fare', prompt: 'How much does it cost to ride LRT-1 from FPJ to Dr. Santos with a Beep Card? What about senior citizen discount?' },
  { label: 'MRT-3 end to end', prompt: 'What is the exact fare for riding MRT-3 from North Avenue to Taft Avenue? Include Beep Card and SJT prices.' },
  { label: 'Gov subsidies', prompt: 'What government subsidies and discount programs are available for Manila rail transit commuters in 2026?' },
];

// ── Data Stream Animation Component ──────────────────────────────────────
function DataStreamLines({ active }: { active: boolean }) {
  const line1 = useRef(new RNAnimated.Value(0)).current;
  const line2 = useRef(new RNAnimated.Value(0)).current;
  const line3 = useRef(new RNAnimated.Value(0)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (active) {
      RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      const createPulse = (anim: RNAnimated.Value, delay: number) =>
        RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.delay(delay),
            RNAnimated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            RNAnimated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
            RNAnimated.delay(200),
          ])
        );

      const a1 = createPulse(line1, 0);
      const a2 = createPulse(line2, 400);
      const a3 = createPulse(line3, 800);
      a1.start();
      a2.start();
      a3.start();

      return () => {
        a1.stop();
        a2.stop();
        a3.stop();
      };
    } else {
      RNAnimated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      line1.setValue(0);
      line2.setValue(0);
      line3.setValue(0);
    }
  }, [active, line1, line2, line3, opacity]);

  if (!active) return null;

  const renderLine = (anim: RNAnimated.Value, top: number) => (
    <RNAnimated.View
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: 1.5,
        opacity: RNAnimated.multiply(opacity, anim),
        backgroundColor: Colors.electricCyan,
        shadowColor: Colors.electricCyan,
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 4,
        transform: [{
          scaleX: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 1, 0.3],
          }),
        }],
      }}
    />
  );

  return (
    <RNAnimated.View style={[dsStyles.container, { opacity }]}>
      {renderLine(line1, 0)}
      {renderLine(line2, 3)}
      {renderLine(line3, 6)}
      <RNAnimated.View style={[dsStyles.glowBar, {
        opacity: line1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0.6, 0],
        }),
      }]} />
    </RNAnimated.View>
  );
}

const dsStyles = StyleSheet.create({
  container: {
    height: 10,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(64,224,255,0.08)',
  },
});

// ── Glowing Cyan Orb Component ───────────────────────────────────────────
function GlowingOrb({ breathAnim }: { breathAnim: RNAnimated.Value }) {
  return (
    <RNAnimated.View
      style={[
        orbStyles.wrapper,
        { transform: [{ scale: breathAnim }] },
      ]}
    >
      {/* Outer glow ring */}
      <RNAnimated.View
        style={[
          orbStyles.outerGlow,
          {
            transform: [{ scale: breathAnim }],
            opacity: breathAnim.interpolate({
              inputRange: [1, 1.18],
              outputRange: [0.4, 0],
            }),
          },
        ]}
      />
      {/* Middle ring */}
      <RNAnimated.View
        style={[
          orbStyles.middleRing,
          {
            opacity: breathAnim.interpolate({
              inputRange: [1, 1.18],
              outputRange: [0.6, 0.2],
            }),
          },
        ]}
      />
      {/* Core orb */}
      <View style={orbStyles.core}>
        <RNAnimated.View
          style={[
            orbStyles.coreInner,
            {
              transform: [{ scale: breathAnim }],
            },
          ]}
        />
      </View>
    </RNAnimated.View>
  );
}

const orbStyles = StyleSheet.create({
  wrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    alignSelf: 'flex-end',
  },
  outerGlow: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.electricCyan,
  },
  middleRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.electricCyan,
  },
  core: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(64,224,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.50)',
  },
  coreInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.electricCyan,
    shadowColor: Colors.electricCyan,
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
  },
});

// ── Header Orb (larger version) ──────────────────────────────────────────
function HeaderOrb({ breathAnim }: { breathAnim: RNAnimated.Value }) {
  return (
    <View style={headerOrbStyles.wrapper}>
      <RNAnimated.View
        style={[
          headerOrbStyles.outerGlow,
          {
            transform: [{ scale: breathAnim }],
            opacity: breathAnim.interpolate({
              inputRange: [1, 1.18],
              outputRange: [0.35, 0],
            }),
          },
        ]}
      />
      <View style={headerOrbStyles.ring}>
        <RNAnimated.View
          style={[
            headerOrbStyles.core,
            { transform: [{ scale: breathAnim }] },
          ]}
        />
      </View>
    </View>
  );
}

const headerOrbStyles = StyleSheet.create({
  wrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.electricCyan,
  },
  ring: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(64,224,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(64,224,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  core: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.electricCyan,
    shadowColor: Colors.electricCyan,
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
  },
});

// ── Main Screen ──────────────────────────────────────────────────────────
export default function MetroAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Welcome, commuter. I'm MetroAI Neural.\n\nYour dedicated Rail Intelligence for Manila 2026 -- covering LRT-1, MRT-3, and LRT-2 with real-time data from the MetroRide cloud.\n\nAsk me about fares, routes, transfers, government subsidies, or live station status. Tap the mic for voice, or camera for station photo analysis.\n\nRail-only specialist. No buses or jeepneys.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [conversationHistory, setConversationHistory] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [scanningImageId, setScanningImageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const micPulseAnim = useRef(new RNAnimated.Value(1)).current;
  const micPulseLoop = useRef<RNAnimated.CompositeAnimation | null>(null);
  // Electric Cyan breathing pulse on AI orb
  const aiBreathAnim = useRef(new RNAnimated.Value(1)).current;
  const aiBreathLoop = useRef<RNAnimated.CompositeAnimation | null>(null);
  // Laser scan anim for images
  const laserAnim = useRef(new RNAnimated.Value(0)).current;

  const { generateText, isLoading: isGenerating } = useTextGeneration();
  const { analyzeImage, isLoading: isAnalyzing } = useImageAnalysis();
  const { transcribeAudio, isLoading: isTranscribing } = useAudioTranscription();

  const { isLiveData, cloudStations, lastSync } = useTransitDataSync();

  const isLoading = isGenerating || isAnalyzing || isTranscribing;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= MAX_CHAT_MESSAGES) return prev;
      const welcome = prev[0];
      const rest = prev.slice(-(MAX_CHAT_MESSAGES - 1));
      return [welcome, ...rest];
    });
  }, [messages.length]);

  // AI orb breathing pulse
  useEffect(() => {
    aiBreathLoop.current = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(aiBreathAnim, { toValue: 1.18, duration: 1800, useNativeDriver: true }),
        RNAnimated.timing(aiBreathAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    aiBreathLoop.current.start();
    return () => {
      aiBreathLoop.current?.stop();
    };
  }, [aiBreathAnim]);

  // Mic pulse on recording
  useEffect(() => {
    if (isRecording) {
      micPulseLoop.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(micPulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          RNAnimated.timing(micPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      micPulseLoop.current.start();
    } else {
      micPulseLoop.current?.stop();
      micPulseAnim.setValue(1);
    }
  }, [isRecording, micPulseAnim]);

  // Laser scan loop
  useEffect(() => {
    if (scanningImageId) {
      laserAnim.setValue(0);
      RNAnimated.loop(
        RNAnimated.timing(laserAnim, { toValue: 1, duration: 1400, useNativeDriver: true })
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [scanningImageId, laserAnim]);

  const buildContextHistory = useCallback((msgList: ChatMessage[]) => {
    const contextMsgs = msgList
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.id !== 'welcome')
      .slice(-MAX_CONTEXT_MESSAGES);
    return contextMsgs
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      hapticLight();

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');

      const trimmedHistory = buildContextHistory(messages);

      let liveDataNote = '';
      if (isLiveData && cloudStations && cloudStations.length > 0) {
        const syncTimeStr = lastSync ? lastSync.toLocaleTimeString() : 'recently';
        const abnormal = cloudStations.filter((s) => s.status && s.status !== 'Normal');
        const statusSummary =
          abnormal.length > 0
            ? abnormal.map((s) => `${s.name} (${s.line}): ${s.status}`).join(', ')
            : 'All stations operating normally';
        liveDataNote =
          `\n[Live Cloud Data: Active -- Supabase real-time sync at ${syncTimeStr}]\n` +
          `[Station Status (${cloudStations.length} stations from Supabase): ${statusSummary}]\n` +
          `[Fare Matrix: 2026 official tables active -- LRT-1 Cavite Extension (FPJ->Dr. Santos) confirmed]`;
      } else if (isLiveData) {
        liveDataNote = '\n[Live Cloud Data: Active -- fare matrix and station data is up to date from Supabase cloud sync]';
      } else {
        liveDataNote = '\n[Offline Mode: Serving from cached 2026 fare tables and station data]';
      }

      const fullPrompt = `${SYSTEM_CONTEXT}${liveDataNote}\n\nConversation history:\n${trimmedHistory}\n\nUser: ${text.trim()}\n\nAssistant:`;

      try {
        const response = await generateText(fullPrompt);
        const aiResponse = response ?? 'Sorry, I could not generate a response. Please try again.';

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setConversationHistory(
          (prev) => `${prev}\nUser: ${text.trim()}\nAssistant: ${aiResponse}`
        );
        hapticSuccess();
      } catch (err) {
        void logError('ai_text', err, `Query: "${text.trim().slice(0, 80)}"`);

        const wisdomIndex = Math.floor(Math.random() * TRANSIT_WISDOM_FALLBACKS.length);
        const fallbackContent =
          `MetroAI is temporarily unavailable. Here's your Transit Wisdom while we reconnect:\n\n` +
          TRANSIT_WISDOM_FALLBACKS[wisdomIndex];

        const errMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        hapticWarning();
      }
    },
    [isLoading, generateText, buildContextHistory, isLiveData, cloudStations, lastSync, messages]
  );

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission', 'Please allow microphone access to use voice queries.', [{ text: 'OK' }]);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      setRecordingInstance(recording);
      setIsRecording(true);
      hapticMedium();
    } catch {
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingInstance) return;
    hapticMedium();

    try {
      setIsRecording(false);
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      setRecordingInstance(null);

      if (!uri) {
        Alert.alert('Recording Error', 'No audio captured. Please try again.');
        return;
      }

      const voiceMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: 'Transcribing your voice...',
        timestamp: new Date(),
        isVoice: true,
      };
      setMessages((prev) => [...prev, voiceMsg]);

      const transcript = await transcribeAudio({ audioUri: uri, language: 'en' });

      if (!transcript || !transcript.trim()) {
        setMessages((prev) =>
          prev.map((m) => m.id === voiceMsg.id ? { ...m, content: 'Could not understand audio. Please try again.' } : m)
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) => m.id === voiceMsg.id ? { ...m, content: `"${transcript}"` } : m)
      );

      const fullPrompt = `${SYSTEM_CONTEXT}\n\nConversation history:\n${conversationHistory}\n\nUser: ${transcript.trim()}\n\nAssistant:`;
      const response = await generateText(fullPrompt);
      const aiResponse = response ?? 'Sorry, I could not respond. Please try again.';

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setConversationHistory((prev) => `${prev}\nUser: ${transcript}\nAssistant: ${aiResponse}`);
      hapticSuccess();
    } catch (err) {
      setIsRecording(false);
      setRecordingInstance(null);
      void logError('ai_voice', err, 'Voice query transcription/generation failure');

      const wisdomIndex = Math.floor(Math.random() * TRANSIT_WISDOM_FALLBACKS.length);
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          `Voice query could not be processed. Here's a Transit Wisdom tip instead:\n\n` +
          TRANSIT_WISDOM_FALLBACKS[wisdomIndex],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
      hapticWarning();
    }
  }, [recordingInstance, transcribeAudio, conversationHistory, generateText]);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleImageUpload = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const imageUri = result.assets[0].uri;
    const msgId = Date.now().toString();

    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: 'Analyzing this station image...',
      imageUri,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setScanningImageId(msgId);

    try {
      const response = await analyzeImage({
        imageUrl: imageUri,
        prompt: 'Analyze this Philippine metro station image. Identify: 1) Crowd density (light/moderate/heavy with percentage estimate), 2) Any visible delays or issues (broken elevators, long lines, technical problems), 3) Overall station status, 4) Recommendations for commuters. Be concise and actionable.',
      });
      setScanningImageId(null);

      const aiText = response ?? 'Could not analyze the image. Please try again.';
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Vision Analysis\n\n${aiText}`,
        timestamp: new Date(),
        isVisionAnalysis: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setScanningImageId(null);
      void logError('ai_vision', err, 'Image library vision analysis failure');
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          `Vision analysis temporarily unavailable.\n\n` +
          TRANSIT_WISDOM_FALLBACKS[Math.floor(Math.random() * TRANSIT_WISDOM_FALLBACKS.length)],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [analyzeImage]);

  const handleCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow camera access for live Vision Analysis.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    const imageUri = result.assets[0].uri;
    const msgId = Date.now().toString();

    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: 'Analyzing live station photo...',
      imageUri,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setScanningImageId(msgId);

    try {
      const response = await analyzeImage({
        imageUrl: imageUri,
        prompt: 'Analyze this live Philippine metro station photo. Assess: 1) Crowd density and wait time estimate, 2) Any visible issues or delays, 3) Safety observations, 4) Quick recommendation for this commuter. Keep it brief and practical.',
      });
      setScanningImageId(null);

      const aiText = response ?? 'Could not analyze the image.';
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Live Analysis\n\n${aiText}`,
        timestamp: new Date(),
        isVisionAnalysis: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setScanningImageId(null);
      void logError('ai_vision', err, 'Camera live vision analysis failure');
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          `Live vision analysis temporarily unavailable.\n\n` +
          TRANSIT_WISDOM_FALLBACKS[Math.floor(Math.random() * TRANSIT_WISDOM_FALLBACKS.length)],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [analyzeImage]);

  const laserY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  });

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';
      const isScanning = item.id === scanningImageId;

      return (
        <Animated.View
          entering={isUser ? FadeInLeft.duration(300) : FadeInUp.duration(300).delay(50)}
          style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
        >
          {!isUser && (
            <GlowingOrb breathAnim={aiBreathAnim} />
          )}
          <View style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
            Platform.OS === 'web' && !isUser && ({
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            } as object),
            Platform.OS === 'web' && isUser && ({
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            } as object),
          ]}>
            {item.imageUri && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
                {isScanning && (
                  <RNAnimated.View
                    style={[
                      styles.laserScan,
                      { transform: [{ translateY: laserY }] },
                    ]}
                    pointerEvents="none"
                  />
                )}
                {isScanning && (
                  <View style={styles.scanOverlay} pointerEvents="none">
                    <View style={styles.scanCornerTL} />
                    <View style={styles.scanCornerTR} />
                    <View style={styles.scanCornerBL} />
                    <View style={styles.scanCornerBR} />
                    <Text style={styles.scanText}>SCANNING</Text>
                  </View>
                )}
              </View>
            )}
            {item.isVisionAnalysis && (
              <View style={styles.visionBadge}>
                <Ionicons name="eye-outline" size={12} color={Colors.electricCyan} />
                <Text style={styles.visionBadgeText}>Vision Analysis</Text>
              </View>
            )}
            {item.isVoice && (
              <View style={styles.voiceBadge}>
                <Ionicons name="mic" size={12} color={Colors.electricCyan} />
                <Text style={styles.voiceBadgeText}>Voice Query</Text>
              </View>
            )}
            <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.aiMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
              {item.timestamp.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
        </Animated.View>
      );
    },
    [scanningImageId, laserY, aiBreathAnim]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Data Stream Lines - animated during live data fetches */}
      <DataStreamLines active={isLoading || isLiveData} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <HeaderOrb breathAnim={aiBreathAnim} />
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Metro AI</Text>
              {isLiveData && <LiveDataBadge visible compact />}
            </View>
            <Text style={styles.headerSubtitle}>Neural Rail Intelligence / Manila 2026</Text>
          </View>
        </View>
        <View style={styles.freeAccessBadge}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.freeAccessText}>Free</Text>
        </View>
      </View>

      {/* Quick prompts */}
      <View>
        <FlatList
          horizontal
          data={QUICK_PROMPTS}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPromptsContainer}
          renderItem={({ item }) => (
            <Pressable
              style={styles.quickPromptChip}
              onPress={() => { hapticLight(); sendMessage(item.prompt); }}
            >
              <Text style={styles.quickPromptText}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      {/* Recording Banner */}
      {isRecording && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.recordingBanner}>
          <RNAnimated.View style={[styles.recordingDot, { transform: [{ scale: micPulseAnim }] }]} />
          <Text style={styles.recordingText}>Recording... Tap mic to stop</Text>
          <Pressable onPress={stopRecording} style={styles.stopBtn}>
            <Ionicons name="stop-circle" size={20} color={Colors.error} />
          </Pressable>
        </Animated.View>
      )}

      {/* Transcribing Banner */}
      {isTranscribing && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.transcribingBanner}>
          <Ionicons name="hourglass-outline" size={16} color={Colors.electricCyan} />
          <Text style={styles.transcribingText}>Transcribing audio...</Text>
        </Animated.View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 60}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={(isGenerating || isAnalyzing) ? <TypingIndicator /> : null}
          onContentSizeChange={scrollToBottom}
        />

        {/* Vision info bar */}
        <View style={styles.visionInfoBar}>
          <Ionicons name="eye-outline" size={14} color={Colors.electricCyan} />
          <Text style={styles.visionInfoText}>
            Vision Analysis: Upload station photos for crowd & delay detection
          </Text>
          <View style={styles.visionFreeTag}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.visionFreeTagText}>Free</Text>
          </View>
        </View>

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable onPress={handleCamera} style={styles.inputAction}>
            <Ionicons name="camera-outline" size={22} color={Colors.electricCyan} />
          </Pressable>
          <Pressable onPress={handleImageUpload} style={styles.inputAction}>
            <Ionicons name="image-outline" size={22} color={Colors.electricCyan} />
          </Pressable>

          <View style={styles.textInputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={isRecording ? 'Listening...' : 'Ask about fares, routes, subsidies...'}
              placeholderTextColor={isRecording ? Colors.error : Colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
              editable={!isRecording}
            />
          </View>

          {/* Mic Button */}
          <RNAnimated.View style={{ transform: [{ scale: isRecording ? micPulseAnim : 1 }] }}>
            <Pressable
              onPress={handleMicPress}
              disabled={isTranscribing}
              style={[
                styles.micBtn,
                isRecording && styles.micBtnActive,
                isTranscribing && styles.micBtnDisabled,
              ]}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={18}
                color="#FFF"
              />
            </Pressable>
          </RNAnimated.View>

          {/* Send Button */}
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading || isRecording}
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading || isRecording) && styles.sendBtnDisabled,
            ]}
          >
            <Ionicons
              name={isGenerating ? 'hourglass-outline' : 'send'}
              size={18}
              color="#08090A"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(13,14,16,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(64,224,255,0.08)',
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.electricCyan,
    fontWeight: FontWeight.medium,
    opacity: 0.7,
  },
  freeAccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.10)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
  },
  freeAccessText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
  },
  quickPromptsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  quickPromptChip: {
    backgroundColor: 'rgba(64,224,255,0.08)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.18)',
  },
  quickPromptText: {
    fontSize: FontSize.sm,
    color: Colors.electricCyan,
    fontWeight: FontWeight.medium,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,68,68,0.08)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,68,68,0.20)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },
  stopBtn: {
    padding: 4,
  },
  transcribingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(64,224,255,0.06)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(64,224,255,0.15)',
  },
  transcribingText: {
    fontSize: FontSize.sm,
    color: Colors.electricCyan,
    fontWeight: FontWeight.medium,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiRow: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    maxWidth: '100%',
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: 'rgba(187,68,255,0.14)',
    borderBottomRightRadius: 6,
    borderColor: 'rgba(187,68,255,0.25)',
    shadowColor: Colors.lrt2,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  aiBubble: {
    backgroundColor: 'rgba(64,224,255,0.05)',
    borderBottomLeftRadius: 6,
    borderColor: 'rgba(64,224,255,0.12)',
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  // Image container with laser scan
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  messageImage: {
    width: 200,
    height: 140,
    borderRadius: BorderRadius.md,
  },
  laserScan: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.electricCyan,
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  scanOverlay: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1.5,
    borderColor: Colors.electricCyan,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(64,224,255,0.04)',
  },
  scanCornerTL: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: Colors.electricCyan,
  },
  scanCornerTR: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.electricCyan,
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: Colors.electricCyan,
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.electricCyan,
  },
  scanText: {
    fontSize: 9,
    fontWeight: FontWeight.heavy,
    color: Colors.electricCyan,
    letterSpacing: 2,
  },
  visionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.20)',
  },
  visionBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.electricCyan,
    fontWeight: FontWeight.semibold,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(64,224,255,0.08)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.18)',
  },
  voiceBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.electricCyan,
    fontWeight: FontWeight.semibold,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  userMessageText: {
    color: Colors.text,
  },
  aiMessageText: {
    color: Colors.text,
    opacity: 0.9,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.4)',
  },
  visionInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(64,224,255,0.06)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(64,224,255,0.12)',
  },
  visionInfoText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  visionFreeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34,197,94,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
  },
  visionFreeTagText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(13,14,16,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(64,224,255,0.06)',
  },
  inputAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(64,224,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.18)',
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.10)',
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 80,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.electricCyan,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  micBtnActive: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    shadowOpacity: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.electricCyan,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    shadowOpacity: 0,
  },
});
