/**
 * AP Autos Driver App - Auth Context
 * Manages login state, token, and user data using AsyncStorage.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/config';

interface User {
  id: number;
  phone_number: number;
  name: string | null;
  role: string;
  preferred_language: string;
  profile_photo_url: string | null;
  driver?: {
    driver_id: number;
    vehicle_registration: string | null;
    is_online: boolean;
    rating: number;
    total_rides: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (phone: number, otp: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check for stored token
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('ap_token');
      if (storedToken) {
        setToken(storedToken);
        await fetchProfile(storedToken);
      }
    } catch (e) {
      console.log('Failed to load stored auth', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/auth/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
      } else {
        // Token expired or invalid
        await logout();
      }
    } catch (e) {
      console.log('Profile fetch failed', e);
    }
  };

  const login = async (phone: number, otp: string) => {
    try {
      // Step 1: Send OTP
      await fetch(`${Config.API_URL}${Config.API_PREFIX}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });

      // Step 2: Verify OTP
      const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp, role: 'driver' }),
      });
      const data = await res.json();

      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        await AsyncStorage.setItem('ap_token', data.token);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Login failed' };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('ap_token');
  };

  const refreshProfile = async () => {
    if (token) await fetchProfile(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggedIn: !!token && !!user,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
