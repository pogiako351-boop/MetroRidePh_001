/**
 * MetroRide PH — Global Error Boundary
 * Prevents application crashes and displays Safe Fallback UI
 * with access to the route planner and fare calculator.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logError } from '@/utils/errorLogger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log silently — never re-throw
    logError('general', error, 'GlobalErrorBoundary', {
      componentStack: (info.componentStack ?? '').slice(0, 300),
    }).catch(() => {
      // Double-safety: even logging must not throw
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  private navigate = (path: string): void => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = path;
    } else {
      this.handleReset();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorId } = this.state;

    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Shield icon */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconBg}>
              <Ionicons name="shield-half" size={44} color="#40E0FF" />
            </View>
            <View style={styles.iconPulse} />
          </View>

          <Text style={styles.title}>Safe Fallback Mode</Text>
          <Text style={styles.subtitle}>
            MetroRide activated its safety shield after an unexpected error.
            Core commuter tools remain available.
          </Text>

          {/* Error ID */}
          {errorId && (
            <View style={styles.errorIdRow}>
              <Text style={styles.errorIdLabel}>Incident ID:</Text>
              <Text style={styles.errorIdValue}>{errorId}</Text>
            </View>
          )}

          {/* Error details */}
          {error && (
            <View style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <Ionicons name="alert-circle" size={15} color="#FF4444" />
                <Text style={styles.errorHeaderText}>Error Details</Text>
              </View>
              <Text style={styles.errorMsg} numberOfLines={4}>
                {error.message || 'An unexpected error occurred'}
              </Text>
            </View>
          )}

          {/* Section label */}
          <Text style={styles.sectionLabel}>TOOLS STILL AVAILABLE</Text>

          {/* Quick access actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => this.navigate('/fare-calculator')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(64,224,255,0.15)' }]}>
                <Ionicons name="calculator" size={26} color="#40E0FF" />
              </View>
              <Text style={styles.actionTitle}>Fare Calculator</Text>
              <Text style={styles.actionSub}>2026 fares · All lines</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => this.navigate('/route-planner')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(64,224,255,0.15)' }]}>
                <Ionicons name="navigate" size={26} color="#40E0FF" />
              </View>
              <Text style={styles.actionTitle}>Route Planner</Text>
              <Text style={styles.actionSub}>Multi-line transfers</Text>
            </TouchableOpacity>
          </View>

          {/* Transit map */}
          <TouchableOpacity
            style={styles.mapCard}
            onPress={() => this.navigate('/transit-map')}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={20} color="#7AEFFF" />
            <Text style={styles.mapText}>View Transit Map</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {/* Recovery buttons */}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleReset}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={18} color="#0A0F1E" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => this.navigate('/')}
            activeOpacity={0.8}
          >
            <Text style={styles.homeBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            MetroRide PH · Safe Fallback Active · FPJ→Dr. Santos 2026
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08090A',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  iconWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(64,224,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(64,224,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPulse: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.12)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    maxWidth: 300,
  },
  errorIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  errorIdLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  errorIdValue: {
    fontSize: 11,
    color: '#40E0FF',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,68,68,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
  },
  errorHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF4444',
  },
  errorMsg: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 360,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 3,
    textAlign: 'center',
  },
  actionSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  mapText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#7AEFFF',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#40E0FF',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 360,
    marginBottom: 12,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0F1E',
  },
  homeBtn: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 28,
  },
  homeBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ErrorBoundary;
