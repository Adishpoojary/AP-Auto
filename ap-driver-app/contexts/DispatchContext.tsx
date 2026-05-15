import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import Config from '../constants/config';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { Alert, Vibration } from 'react-native';

interface RideRequestData {
  ride_id: number;
  pickup_address: string;
  drop_address: string;
  distance_to_pickup: number;
  estimated_fare: number;
  driver_earning: number;
  customer_name: string;
}

export interface ActiveTripData {
  id: number;
  booking_code: string;
  status: 'accepted' | 'driver_arrived' | 'ride_started' | 'ride_completed';
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_address: string;
  drop_lat: number;
  drop_lng: number;
  total_customer_fare: number;
  ride_otp: string;
}

interface DispatchContextType {
  isConnected: boolean;
  activeRequest: RideRequestData | null;
  currentTrip: ActiveTripData | null;
  qrData: string | null;
  acceptRide: () => Promise<void>;
  rejectRide: () => Promise<void>;
  fetchActiveTrip: () => Promise<void>;
  updateTripStatus: (status: 'driver_arrived' | 'ride_started' | 'ride_completed', otp?: string) => Promise<boolean>;
  clearQr: () => void;
}

const DispatchContext = createContext<DispatchContextType>({} as DispatchContextType);
export const useDispatch = () => useContext(DispatchContext);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const { isOnline } = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [activeRequest, setActiveRequest] = useState<RideRequestData | null>(null);
  const [currentTrip, setCurrentTrip] = useState<ActiveTripData | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Only connect if logged in AND driver intends to be online
    if (isLoggedIn && token && isOnline) {
      connectWebSocket();
      fetchActiveTrip(); // Fetch any existing trip
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isLoggedIn, token, isOnline]);

  const fetchActiveTrip = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/rides/active/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setCurrentTrip(json.data);
        } else {
          setCurrentTrip(null);
        }
      }
    } catch (e) {
      console.log('Failed to fetch active trip');
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) return; // Already connected
    
    // Config.API_URL -> http://192.168.x.x:8000
    const wsUrl = Config.API_URL.replace('http:', 'ws:').replace('https:', 'wss:') + `/api/v1/dispatch/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔗 [Dispatch WS] Connected to AP Command Center');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_RIDE_REQUEST') {
          handleNewRide(message.data);
        }
      } catch (e) {
        console.log('Error parsing WS message', e);
      }
    };

    ws.onclose = () => {
      console.log('❌ [Dispatch WS] Disconnected');
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect logic could go here
    };

    wsRef.current = ws;
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleNewRide = async (data: RideRequestData) => {
    setActiveRequest(data);
    // Vibrate in a distinct pattern: wait 0, vibrate 500ms, wait 200, vibrate 500, etc.
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  };

  const acceptRide = async () => {
    if (!activeRequest) return;
    try {
      const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/rides/${activeRequest.ride_id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Stop vibration
        Vibration.cancel();
        setActiveRequest(null);
        await fetchActiveTrip();
      } else {
        const error = await res.json();
        Alert.alert('Error', error.detail || 'Could not accept ride');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
    }
  };

  const rejectRide = async () => {
    if (!activeRequest) return;
    try {
      await fetch(`${Config.API_URL}${Config.API_PREFIX}/rides/${activeRequest.ride_id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
    Vibration.cancel();
    setActiveRequest(null);
  };

  const clearQr = () => { setQrData(null); };

  const updateTripStatus = async (status: string, otp?: string) => {
    if (!currentTrip) return false;
    
    let endpoint = '';
    if (status === 'driver_arrived') endpoint = 'arrived';
    else if (status === 'ride_started') endpoint = `start?otp=${otp}`;
    else if (status === 'ride_completed') endpoint = 'complete';
    
    try {
      const res = await fetch(`${Config.API_URL}${Config.API_PREFIX}/rides/${currentTrip.id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (status === 'ride_completed') {
          // Show QR code for payment
          if (data.data?.qr_data) {
            setQrData(data.data.qr_data);
          }
          setCurrentTrip(null);
        } else {
          await fetchActiveTrip();
        }
        return true;
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Could not update trip');
        return false;
      }
    } catch (e) {
      Alert.alert('Error', 'Network connection failed');
      return false;
    }
  };

  return (
    <DispatchContext.Provider value={{ isConnected, activeRequest, currentTrip, qrData, acceptRide, rejectRide, fetchActiveTrip, updateTripStatus, clearQr }}>
      {children}
    </DispatchContext.Provider>
  );
}
