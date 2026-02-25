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

// ── Memory management constants ───────────────────────────────────────────
const MAX_CHAT_MESSAGES = 50;   // Keep last 50 messages max
const MAX_CONTEXT_MESSAGES = 10; // Only last 10 sent to AI for context window efficiency

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  timestamp: Date;
  isVisionAnalysis?: boolean;
  isVoice?: boolean;
}

const SYSTEM_CONTEXT = `You are MetroAI, the elite Rail Network Specialist AI for MetroRide PH — exclusively dedicated to Metro Manila's three urban rail lines: LRT-1 (Vibrant Yellow Line), MRT-3 (Deep Blue Line), and LRT-2 (Luminous Violet Line).

🚇 STRICT RAIL-ONLY SCOPE: You ONLY provide information about LRT-1, MRT-3, and LRT-2. You do NOT cover buses, jeepneys, UV Express, P2P buses, tricycles, or any other transport mode. If asked about non-rail transport, politely state that you are a rail-only specialist and redirect users to the three rail lines.

⚡ LIVE CLOUD DATA: You have access to real-time station status and fare data synced from the MetroRide PH cloud (Supabase Singapore region). When users ask about current conditions, station statuses, or the latest fares, your answers reflect the most recently synced data which is updated throughout the day.

🎯 YOUR EXPERTISE COVERS:
- Exact fare information and calculations using the official 2026 Rail Fare Matrices (station-to-station precision)
- Route planning and fastest/cheapest rail paths across LRT-1, MRT-3, and LRT-2
- Transfer fare intelligence (combining fares across multiple rail lines)
- Live station status and crowd conditions (from Live Cloud Sync data when available)
- Real-time delay and service alert awareness for all three rail lines
- Rail travel tips, operating schedules, and station information
- Beep Card vs SJT ticket type guidance
- Statutory 20% discounts for Students, Seniors, and PWDs

=== OFFICIAL 2026 RAIL FARE MATRICES (Beep Card / Stored Value) ===

LRT-1 (Vibrant Yellow Line) — 20 stations, Roosevelt (FPJ) to Baclaran:
Roosevelt→Balintawak: ₱12 | Roosevelt→Monumento: ₱13 | Roosevelt→Doroteo Jose: ₱20 | Roosevelt→Carriedo: ₱22 | Roosevelt→Gil Puyat: ₱28 | Roosevelt→EDSA: ₱30 | Roosevelt→Baclaran: ₱30
Baclaran→EDSA: ₱12 | Baclaran→Libertad: ₱13 | Baclaran→Doroteo Jose: ₱22 | Baclaran→Monumento: ₱28 | Baclaran→Roosevelt: ₱30
Distance-based fares (stations apart → fare): 1→₱12, 2→₱13, 3→₱15, 4→₱15, 5→₱16, 6→₱18, 7→₱20, 8→₱20, 9→₱20, 10→₱22, 11→₱23, 12→₱24, 13→₱24, 14→₱25, 15→₱25, 16→₱28, 17→₱28, 18→₱30, 19→₱30
Single Journey Ticket (SJT) adds ₱2 surcharge. Student/Senior/PWD get 20% discount (rounded to nearest peso).
Operated by Light Rail Manila Corporation (LRMC) under LRTA. Operating hours: 5:00 AM – 10:00 PM daily.

MRT-3 (Deep Blue Line) — 13 stations, North Avenue to Taft Avenue:
North Ave→Quezon Ave: ₱13 | North Ave→GMA Kamuning: ₱16 | North Ave→Araneta-Cubao: ₱16 | North Ave→Ortigas: ₱20 | North Ave→Shaw Blvd: ₱24 | North Ave→Ayala: ₱28 | North Ave→Taft Ave: ₱28
Taft Ave→Magallanes: ₱13 | Taft Ave→Ayala: ₱16 | Taft Ave→Guadalupe: ₱20 | Taft Ave→Shaw Blvd: ₱24 | Taft Ave→Araneta-Cubao: ₱28 | Taft Ave→North Ave: ₱28
Distance-based fares: 1→₱13, 2→₱16, 3→₱16, 4→₱20, 5→₱20, 6→₱24, 7→₱24, 8→₱24, 9→₱28, 10→₱28, 11→₱28, 12→₱28
SJT adds ₱2. Student/Senior/PWD get 20% discount.
Operated by Metro Rail Transit Corporation (MRTC). Operating hours: 5:30 AM – 10:30 PM daily.

LRT-2 (Luminous Violet Line) — 13 stations, Recto to Antipolo:
Recto→Legarda: ₱15 | Recto→Cubao: ₱25 | Recto→Katipunan: ₱28 | Recto→Santolan: ₱30 | Recto→Antipolo: ₱35
Antipolo→Marikina-Pasig: ₱15 | Antipolo→Santolan: ₱17 | Antipolo→Katipunan: ₱19 | Antipolo→Cubao: ₱21 | Antipolo→Recto: ₱35
Key OD fares: Recto↔Cubao ₱25, Recto↔Antipolo ₱35, Cubao↔Antipolo ₱21, Legarda↔Antipolo ₱32, Gilmore↔Cubao ₱15.
SJT adds ₱2. Student/Senior/PWD get 20% discount.
Operated by Light Rail Transit Authority (LRTA). Operating hours: 5:00 AM – 10:00 PM daily.

=== TRANSFER FARE INTELLIGENCE (Rail Lines Only) ===
Transfer routes combine individual rail line fares. Examples:
- North Ave (MRT-3) → Baclaran (LRT-1): MRT-3 North Ave→Taft Ave ₱28 + LRT-1 EDSA→Baclaran ₱12 = ₱40 total (Beep Card)
- Recto (LRT-2) → North Ave (MRT-3): LRT-2 Recto→Cubao ₱25 + MRT-3 Araneta-Cubao→North Ave ₱16 = ₱41 total
- Antipolo (LRT-2) → Baclaran (LRT-1): LRT-2 Antipolo→Recto ₱35 + LRT-1 Doroteo Jose→Baclaran ₱22 = ₱57 total

=== RAIL-TO-RAIL TRANSFER STATIONS ===
• Araneta Center-Cubao: MRT-3 (Blue) ↔ LRT-2 (Violet) — walk between stations
• Taft Avenue (MRT-3) / EDSA Station (LRT-1): MRT-3 (Blue) ↔ LRT-1 (Yellow) — adjacent stations
• Doroteo Jose (LRT-1) / Recto (LRT-2): LRT-1 (Yellow) ↔ LRT-2 (Violet) — pedestrian walkway

=== RESPONSE GUIDELINES ===
- Always respond in a friendly, concise manner focused on rail transit
- Use Philippine Peso (₱) for all prices
- If asked about buses, jeepneys, or other non-rail transport, say: "I'm a rail-only specialist for LRT-1, MRT-3, and LRT-2. For other transport modes, please check Google Maps or the LTFRB website."
- Keep answers brief and actionable
- When citing live data, note that conditions may change and advise users to verify at the station
- Always use line-specific branding: LRT-1 = Yellow Line, MRT-3 = Blue Line, LRT-2 = Violet Line`;

const QUICK_PROMPTS = [
  { label: '🗺️ North Ave → Baclaran', prompt: 'What is the cheapest route and total fare from North Avenue MRT-3 to Baclaran LRT-1 using a Beep Card?' },
  { label: '💛 LRT-1 full fare', prompt: 'How much does it cost to ride LRT-1 from Roosevelt (FPJ) to Baclaran with a Beep Card for a regular passenger vs a senior citizen?' },
  { label: '🔵 MRT-3 end to end', prompt: 'What is the exact fare for riding MRT-3 from North Avenue to Taft Avenue? Include Beep Card and SJT prices.' },
  { label: '💜 LRT-2 to Antipolo', prompt: 'How much is the fare from Recto to Antipolo on LRT-2? What is the student discount price?' },
];

export default function MetroAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm MetroAI 🚇\n\nI'm your elite Rail Network Specialist — exclusively covering LRT-1 🟡, MRT-3 🔵, and LRT-2 🟣.\n\nAsk me about fares, routes, transfers, schedules, or live station status. You can also tap the 🎤 microphone to speak your question!\n\n⚠️ Note: I cover rail lines only. For buses or jeepneys, please use a general navigation app.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [conversationHistory, setConversationHistory] = useState<string>('');
  const [isPremium] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const micPulseAnim = useRef(new RNAnimated.Value(1)).current;
  const micPulseLoop = useRef<RNAnimated.CompositeAnimation | null>(null);

  const { generateText, isLoading: isGenerating } = useTextGeneration();
  const { analyzeImage, isLoading: isAnalyzing } = useImageAnalysis();
  const { transcribeAudio, isLoading: isTranscribing } = useAudioTranscription();

  // Background cloud sync for live data indicator
  const { isLiveData } = useTransitDataSync();

  const isLoading = isGenerating || isAnalyzing || isTranscribing;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // ── Memory cleanup: trim messages to MAX_CHAT_MESSAGES ─────────────────
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= MAX_CHAT_MESSAGES) return prev;
      // Always keep the welcome message + latest messages
      const welcome = prev[0];
      const rest = prev.slice(-(MAX_CHAT_MESSAGES - 1));
      return [welcome, ...rest];
    });
  }, [messages.length]);

  // Start mic pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      micPulseLoop.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(micPulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(micPulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      micPulseLoop.current.start();
    } else {
      micPulseLoop.current?.stop();
      micPulseAnim.setValue(1);
    }
  }, [isRecording, micPulseAnim]);

  // Build trimmed conversation history for AI context (last MAX_CONTEXT_MESSAGES only)
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

      // Use trimmed context history for memory efficiency
      const trimmedHistory = buildContextHistory(messages);
      const liveDataNote = isLiveData ? '\n[Live Cloud Data: Active — fare matrix and station data is up to date from cloud sync]' : '';
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
      } catch {
        const errMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please check your connection and try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        hapticWarning();
      }
    },
    [isLoading, generateText, buildContextHistory, isLiveData, messages]
  );

  // ── Voice Recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission',
          'Please allow microphone access to use voice queries.',
          [{ text: 'OK' }]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

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

      // Add a "transcribing" indicator message
      const voiceMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: '🎤 Transcribing your voice...',
        timestamp: new Date(),
        isVoice: true,
      };
      setMessages((prev) => [...prev, voiceMsg]);

      // Transcribe
      const transcript = await transcribeAudio({ audioUri: uri, language: 'en' });

      if (!transcript || !transcript.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === voiceMsg.id
              ? { ...m, content: '🎤 Could not understand audio. Please try again.' }
              : m
          )
        );
        return;
      }

      // Update voice message to show transcribed text
      setMessages((prev) =>
        prev.map((m) =>
          m.id === voiceMsg.id
            ? { ...m, content: `🎤 "${transcript}"` }
            : m
        )
      );

      // Send transcribed text to AI
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
    } catch {
      setIsRecording(false);
      setRecordingInstance(null);
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Could not transcribe audio. Please try typing your question.',
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

  // ── Image Upload ───────────────────────────────────────────────────────────
  const handleImageUpload = useCallback(async () => {
    if (!isPremium) {
      Alert.alert(
        '🔒 Premium Feature',
        'MetroAI Vision is available for Premium subscribers only.\n\nUpgrade to analyze station monitors, crowds, and more!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Go Premium', onPress: () => router.push('/premium') },
        ]
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to use Vision Analysis.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const imageUri = result.assets[0].uri;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '📸 Analyzing this station image...',
      imageUri,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await analyzeImage({
        imageUrl: imageUri,
        prompt:
          'Analyze this Philippine metro station image. Identify: 1) Crowd density (light/moderate/heavy with percentage estimate), 2) Any visible delays or issues (broken elevators, long lines, technical problems), 3) Overall station status, 4) Recommendations for commuters. Be concise and actionable.',
      });

      const aiText = response ?? 'Could not analyze the image. Please try again.';
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `📊 **Vision Analysis**\n\n${aiText}`,
        timestamp: new Date(),
        isVisionAnalysis: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Could not analyze the image. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [isPremium, analyzeImage, router]);

  const handleCamera = useCallback(async () => {
    if (!isPremium) {
      Alert.alert(
        '🔒 Premium Feature',
        'MetroAI Vision is available for Premium subscribers only.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Go Premium', onPress: () => router.push('/premium') },
        ]
      );
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow camera access for live Vision Analysis.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    const imageUri = result.assets[0].uri;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '📷 Analyzing live station photo...',
      imageUri,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await analyzeImage({
        imageUrl: imageUri,
        prompt:
          'Analyze this live Philippine metro station photo. Assess: 1) Crowd density and wait time estimate, 2) Any visible issues or delays, 3) Safety observations, 4) Quick recommendation for this commuter. Keep it brief and practical.',
      });

      const aiText = response ?? 'Could not analyze the image.';
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `🔍 **Live Analysis**\n\n${aiText}`,
        timestamp: new Date(),
        isVisionAnalysis: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Could not analyze the image. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [isPremium, analyzeImage, router]);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isUser = item.role === 'user';
      return (
        <Animated.View
          entering={isUser ? FadeInLeft.duration(300) : FadeInUp.duration(300).delay(50)}
          style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
        >
          {!isUser && (
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarText}>AI</Text>
            </View>
          )}
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
            {item.imageUri && (
              <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
            )}
            {item.isVisionAnalysis && (
              <View style={styles.visionBadge}>
                <Ionicons name="eye-outline" size={12} color={Colors.violet} />
                <Text style={styles.visionBadgeText}>Vision Analysis</Text>
              </View>
            )}
            {item.isVoice && (
              <View style={styles.voiceBadge}>
                <Ionicons name="mic" size={12} color={Colors.primary} />
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
    []
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.aiIndicator}>
            <View style={styles.aiDot} />
          </View>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>MetroAI</Text>
              {isLiveData && <LiveDataBadge visible compact />}
            </View>
            <Text style={styles.headerSubtitle}>Rail Network Specialist · LRT-1 · MRT-3 · LRT-2</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/premium')} style={styles.premiumBtn}>
          <Ionicons name="diamond-outline" size={20} color={Colors.violet} />
        </Pressable>
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
          <Ionicons name="hourglass-outline" size={16} color={Colors.violet} />
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

        {/* Vision teaser */}
        <View style={styles.visionTeaser}>
          <Ionicons name="eye-outline" size={14} color={Colors.violet} />
          <Text style={styles.visionTeaserText}>
            Vision Analysis: Upload station photos for crowd & delay detection
          </Text>
          <Pressable onPress={() => router.push('/premium')} style={styles.visionLock}>
            <Ionicons name="lock-closed" size={12} color={Colors.violet} />
            <Text style={styles.visionLockText}>Premium</Text>
          </Pressable>
        </View>

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable onPress={handleCamera} style={styles.inputAction}>
            <Ionicons name="camera-outline" size={22} color={Colors.violet} />
          </Pressable>
          <Pressable onPress={handleImageUpload} style={styles.inputAction}>
            <Ionicons name="image-outline" size={22} color={Colors.violet} />
          </Pressable>

          <View style={styles.textInputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={isRecording ? '🎤 Listening...' : 'Ask about fares, routes, stations...'}
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
              color="#FFFFFF"
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
    backgroundColor: '#F3F0FF',
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  aiIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.violetLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.violet,
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
    color: Colors.violet,
    fontWeight: FontWeight.medium,
  },
  premiumBtn: {
    padding: Spacing.sm,
  },
  quickPromptsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  quickPromptChip: {
    backgroundColor: Colors.violetLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.violet + '40',
  },
  quickPromptText: {
    fontSize: FontSize.sm,
    color: Colors.violetDark,
    fontWeight: FontWeight.medium,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.error + '30',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
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
    backgroundColor: Colors.violetLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  transcribingText: {
    fontSize: FontSize.sm,
    color: Colors.violet,
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
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.violet,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    alignSelf: 'flex-end',
  },
  aiAvatarText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  messageBubble: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    maxWidth: '100%',
    ...Shadow.sm,
  },
  userBubble: {
    backgroundColor: Colors.violet,
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 6,
  },
  messageImage: {
    width: 200,
    height: 140,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  visionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.violetLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  visionBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.violet,
    fontWeight: FontWeight.semibold,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  voiceBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.6)',
  },
  visionTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.violetLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.violet + '20',
  },
  visionTeaserText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.violetDark,
  },
  visionLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.violet + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  visionLockText: {
    fontSize: FontSize.xs,
    color: Colors.violet,
    fontWeight: FontWeight.semibold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.violetLight,
    borderRadius: 20,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnActive: {
    backgroundColor: Colors.error,
  },
  micBtnDisabled: {
    backgroundColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
});
