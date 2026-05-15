/**
 * AP Autos Driver App - Login Screen
 * Clean, premium OTP-based login for drivers.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleSendOTP = () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    // Animate transition
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep('otp');
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit OTP.');
      return;
    }
    setLoading(true);
    const result = await login(parseInt(phone), otp);
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Login Failed', result.error || 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Gradient-like background */}
      <View style={styles.topSection}>
        <Text style={styles.logo}>🛺</Text>
        <Text style={styles.appName}>AP Autos</Text>
        <Text style={styles.tagline}>Driver Partner</Text>
      </View>

      <View style={styles.card}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {step === 'phone' ? (
            <>
              <Text style={styles.cardTitle}>Welcome, Driver!</Text>
              <Text style={styles.cardSubtitle}>Enter your phone number to get started</Text>

              <View style={styles.inputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="98765 43210"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, phone.length < 10 && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={phone.length < 10}
              >
                <Text style={styles.buttonText}>Get OTP</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSubtitle}>
                Sent to +91 {phone}{' '}
                <Text style={styles.changeLink} onPress={() => setStep('phone')}>
                  Change
                </Text>
              </Text>

              <TextInput
                style={styles.otpInput}
                placeholder="1 2 3 4"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={setOtp}
                autoFocus
                textAlign="center"
              />

              <Text style={styles.devHint}>💡 Dev OTP: 1234</Text>

              <TouchableOpacity
                style={[styles.button, (otp.length < 4 || loading) && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={otp.length < 4 || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Login</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>

      <Text style={styles.footer}>AP Autos © 2026 — Udupi & Manipal</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topSection: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    flex: 0.5,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
    lineHeight: 20,
  },
  changeLink: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  countryCode: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  otpInput: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  devHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
});
