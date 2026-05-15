/**
 * AP Autos Driver App - Location Context
 * Handles GPS tracking and WebSocket streaming to backend.
 */
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import Config from '../constants/config';
import { useAuth } from './AuthContext';

interface LocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationContextType {
  currentLocation: LocationData | null;
  isTracking: boolean;
  isOnline: boolean;
  locationError: string | null;
  goOnline: () => Promise<void>;
  goOffline: () => void;
}

const LocationContext = createContext<LocationContextType>({} as LocationContextType);
export const useLocation = () => useContext(LocationContext);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  };

  const sendLocation = async (loc: LocationData) => {
    if (!token) return;
    try {
      await fetch(`${Config.API_URL}${Config.API_PREFIX}/drivers/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: loc.latitude,
          lng: loc.longitude,
        }),
      });
    } catch (e) {
      console.log('[Location] Send failed:', e);
    }
  };

  const goOnline = async () => {
    try {
      setLocationError(null);

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable it in Settings.');
        return;
      }

      // Get initial location
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Tell backend we are online
      if (token) {
        const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/drivers/status/online`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to go online on server');
        }
      }
      const initialLoc: LocationData = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        heading: initial.coords.heading,
        speed: initial.coords.speed,
        timestamp: initial.timestamp,
      };
      setCurrentLocation(initialLoc);

      // Start watching location
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: Config.LOCATION_UPDATE_INTERVAL,
          distanceInterval: 5, // minimum 5 meters
        },
        (location) => {
          const loc: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: location.timestamp,
          };
          setCurrentLocation(loc);
          sendLocation(loc);
        }
      );

      locationSubRef.current = sub;
      setIsTracking(true);
      setIsOnline(true);
    } catch (e: any) {
      setLocationError(e.message || 'Failed to start tracking');
      console.error('Location error:', e);
    }
  };

  const goOffline = async () => {
    cleanup();
    setIsTracking(false);
    setIsOnline(false);

    if (token) {
      try {
        await fetch(`${Config.API_URL}${Config.API_PREFIX}/drivers/status/offline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.log('Failed to go offline on server');
      }
    }
  };

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        isTracking,
        isOnline,
        locationError,
        goOnline,
        goOffline,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}
