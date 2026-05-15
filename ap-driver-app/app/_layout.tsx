/**
 * AP Autos Driver App - Root Layout
 * Wraps the app with AuthProvider + LocationProvider.
 * Redirects to login if not authenticated.
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LocationProvider } from '../contexts/LocationContext';
import { DispatchProvider } from '../contexts/DispatchContext';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

// Auth guard that redirects based on login state
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isLoggedIn && !inAuthGroup) {
      // Not logged in, redirect to login
      router.replace('/login');
    } else if (isLoggedIn && inAuthGroup) {
      // Logged in but on login page, redirect to home
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingLogo}>🛺</Text>
        <Text style={styles.loadingText}>AP Autos</Text>
        <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <LocationProvider>
        <DispatchProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGuard>
              <Stack>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
            </AuthGuard>
            <StatusBar style="auto" />
          </ThemeProvider>
        </DispatchProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingLogo: {
    fontSize: 64,
  },
  loadingText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f59e0b',
    marginTop: 12,
  },
});
