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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  timestamp: Date;
  isVisionAnalysis?: boolean;
  isVoice?: boolean;
}

const SYSTEM_CONTEXT = `You are MetroAI, a helpful transit assistant for the Philippine metro rail network (MRT-3, LRT-1, LRT-2). You help commuters with:
- Fare information and calculations
- Route planning and fastest paths
- Station information and nearby places
- Real-time crowd and delay advice
- Travel tips for Manila metro commuters

MRT-3 fares: ₱13-28. LRT-1 fares: ₱12-30. LRT-2 fares: ₱12-25.
Key transfer stations: Araneta Center-Cubao (MRT-3 ↔ LRT-2), Taft/EDSA (MRT-3 ↔ LRT-1), Doroteo Jose/Recto (LRT-1 ↔ LRT-2).
Operating hours: MRT-3 5:30AM–10:30PM, LRT-1 & LRT-2 5:00AM–10:00PM.
Always respond in a friendly, concise manner. Use Philippine Peso (₱) for all prices. Keep answers brief and actionable.`;

const QUICK_PROMPTS = [
  { label: '🗺️ Cheapest route', prompt: 'What is the cheapest route from North Avenue to Baclaran?' },
  { label: '⏱️ Fastest to Cubao', prompt: 'What is the fastest way to get to Araneta Center-Cubao from Taft Avenue MRT?' },
  { label: '💰 MRT-3 fares', prompt: 'How much does it cost to ride MRT-3 from end to end?' },
  { label: '🚇 Rush hour tips', prompt: 'What are tips for commuting during rush hour in the Manila metro?' },
];

export default function MetroAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm MetroAI 🤖\n\nI can help you with fares, routes, and real-time commute advice for MRT-3, LRT-1, and LRT-2.\n\nYou can also speak your question using the 🎤 microphone button!",
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

  const isLoading = isGenerating || isAnalyzing || isTranscribing;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

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

      const fullPrompt = `${SYSTEM_CONTEXT}\n\nConversation history:\n${conversationHistory}\n\nUser: ${text.trim()}\n\nAssistant:`;

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
    [isLoading, conversationHistory, generateText]
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
            <Text style={styles.headerTitle}>MetroAI</Text>
            <Text style={styles.headerSubtitle}>Your Smart Transit Assistant</Text>
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
