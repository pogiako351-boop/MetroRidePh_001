import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlobalFooter } from '@/components/ui/GlobalFooter';

const SUPPORT_EMAIL = 'support@metrorideph.com';

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please fill in your name, email, and message.');
      return;
    }

    // Open mailto link with pre-filled content as a fallback
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || 'MetroRide PH Feedback'
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )}`;

    if (Platform.OS === 'web') {
      // On web, open mailto
      window.open(mailtoUrl, '_blank');
    } else {
      Linking.openURL(mailtoUrl).catch(() => {
        Alert.alert('Error', 'Could not open email client');
      });
    }

    setSubmitted(true);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setSubmitted(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contact Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrapper}>
            <Ionicons name="headset-outline" size={28} color="#00FFFF" />
          </View>
          <Text style={styles.infoTitle}>Get in Touch</Text>
          <Text style={styles.infoText}>
            {"Have questions, feedback, or found a bug? We'd love to hear from you. Our team typically responds within 48 hours."}
          </Text>
        </View>

        {/* Email Quick Link */}
        <Pressable
          style={styles.emailCard}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        >
          <View style={styles.emailIconWrapper}>
            <Ionicons name="mail" size={20} color="#00FFFF" />
          </View>
          <View style={styles.emailContent}>
            <Text style={styles.emailLabel}>Email Us Directly</Text>
            <Text style={styles.emailAddress}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="rgba(0,255,255,0.4)" />
        </Pressable>

        {/* Feedback Form */}
        {!submitted ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Send Feedback</Text>
            <Text style={styles.formSubtitle}>
              {"Fill out the form below and we'll get back to you."}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="What is this about?"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what's on your mind..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={[
                styles.submitBtn,
                (!name.trim() || !email.trim() || !message.trim()) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!name.trim() || !email.trim() || !message.trim()}
            >
              <Ionicons name="send" size={16} color="#000000" />
              <Text style={styles.submitBtnText}>Send Message</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.successCard}>
            <View style={styles.successIconWrapper}>
              <Ionicons name="checkmark-circle" size={40} color="#00FFFF" />
            </View>
            <Text style={styles.successTitle}>Message Sent!</Text>
            <Text style={styles.successText}>
              {"Thank you for reaching out. We'll review your message and respond to "}{email}{" within 48 hours."}
            </Text>
            <Pressable style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Send Another Message</Text>
            </Pressable>
          </View>
        )}

        {/* FAQ Quick Links */}
        <View style={styles.faqCard}>
          <Text style={styles.faqTitle}>Common Topics</Text>
          {[
            { icon: 'cash-outline' as const, label: 'Fare accuracy questions', desc: 'We use official 2026 LRTA/MRTC matrices' },
            { icon: 'bug-outline' as const, label: 'Bug reports', desc: 'Include your device model and steps to reproduce' },
            { icon: 'bulb-outline' as const, label: 'Feature suggestions', desc: 'We welcome ideas for improving MetroRide' },
            { icon: 'shield-outline' as const, label: 'Privacy concerns', desc: 'See our Privacy Policy for full details' },
          ].map((item) => (
            <View key={item.label} style={styles.faqRow}>
              <View style={styles.faqIconWrapper}>
                <Ionicons name={item.icon} size={16} color="#00FFFF" />
              </View>
              <View style={styles.faqContent}>
                <Text style={styles.faqLabel}>{item.label}</Text>
                <Text style={styles.faqDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <GlobalFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  // Info Card
  infoCard: {
    backgroundColor: 'rgba(0,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  infoText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },

  // Email Card
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  emailIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailContent: { flex: 1 },
  emailLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  emailAddress: { fontSize: 13, color: '#00FFFF', marginTop: 2, fontWeight: '500' },

  // Form Card
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  formSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(0,255,255,0.6)', marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00FFFF',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#000000' },

  // Success Card
  successCard: {
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconWrapper: { marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#00FFFF', marginBottom: 8 },
  successText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  resetBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(0,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: '#00FFFF' },

  // FAQ Card
  faqCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  faqTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  faqIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqContent: { flex: 1 },
  faqLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  faqDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
});
