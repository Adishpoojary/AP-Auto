/**
 * AP Autos Driver App - Home Tab (Dashboard)
 * Shows map with driver location, online/offline toggle, and basic stats.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { useDispatch } from '../../contexts/DispatchContext';
import QRCode from 'react-native-qrcode-svg';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { currentLocation, isOnline, locationError, goOnline, goOffline } = useLocation();
  const { activeRequest, currentTrip, qrData, acceptRide, rejectRide, updateTripStatus, clearQr } = useDispatch();
  const mapRef = useRef<MapView>(null);
  
  // State for the OTP input Modal
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');

  const handleToggle = async () => {
    if (isOnline) {
      goOffline();
    } else {
      await goOnline();
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { goOffline(); logout(); } },
    ]);
  };

  // Default to Udupi center
  const region = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : {
        latitude: 13.3409,
        longitude: 74.7421,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };

  // Open Google Maps for turn-by-turn navigation
  const openNavigation = (destLat: number, destLng: number, label: string) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${destLat},${destLng}&dirflg=d`,
      android: `google.navigation:q=${destLat},${destLng}&mode=d`,
    }) || `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    Linking.openURL(url).catch(() => {
      // Fallback to web
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    });
  };

  const handleAction = async () => {
    if (!currentTrip) return;
    if (currentTrip.status === 'accepted') {
      await updateTripStatus('driver_arrived');
    } else if (currentTrip.status === 'driver_arrived') {
      setShowOtpModal(true);
    } else if (currentTrip.status === 'ride_started') {
      await updateTripStatus('ride_completed');
    }
  };

  const handleVerifyOtp = async () => {
    if (!currentTrip) return;
    const success = await updateTripStatus('ride_started', enteredOtp);
    if (success) {
      setShowOtpModal(false);
      setEnteredOtp('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.name || 'Driver'} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {isOnline ? '🟢 You are online' : '⚫ You are offline'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {locationError}</Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          showsUserLocation={isOnline}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {currentLocation && isOnline && !currentTrip && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="You are here"
              description={`Speed: ${currentLocation.speed ? Math.round(currentLocation.speed * 3.6) : 0} km/h`}
            >
              <View style={styles.markerContainer}>
                <Text style={styles.markerEmoji}>🛺</Text>
              </View>
            </Marker>
          )}

          {currentTrip && (
            <>
              {/* Pickup Marker */}
              <Marker
                coordinate={{ latitude: currentTrip.pickup_lat, longitude: currentTrip.pickup_lng }}
                title="Pickup Point"
              >
                <View style={[styles.markerContainer, { borderColor: '#16a34a' }]}>
                  <Text style={styles.markerEmoji}>📍</Text>
                </View>
              </Marker>
              
              {/* Dropoff Marker */}
              <Marker
                coordinate={{ latitude: currentTrip.drop_lat, longitude: currentTrip.drop_lng }}
                title="Drop Location"
              >
                <View style={[styles.markerContainer, { borderColor: '#ef4444' }]}>
                  <Text style={styles.markerEmoji}>🏁</Text>
                </View>
              </Marker>

              {/* Route line from driver to destination */}
              {currentLocation && (
                <Polyline
                  coordinates={[
                    { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                    currentTrip.status === 'ride_started'
                      ? { latitude: currentTrip.drop_lat, longitude: currentTrip.drop_lng }
                      : { latitude: currentTrip.pickup_lat, longitude: currentTrip.pickup_lng },
                  ]}
                  strokeColor={currentTrip.status === 'ride_started' ? '#ef4444' : '#16a34a'}
                  strokeWidth={4}
                  lineDashPattern={[8, 4]}
                />
              )}
            </>
          )}
        </MapView>
      </View>

      {currentTrip ? (
        <View style={styles.activeTripBoard}>
          <View style={styles.tripBoardHeader}>
            <Text style={styles.tripBoardTitle}>Active Trip</Text>
            <Text style={styles.tripBoardCode}>Code: {currentTrip.booking_code}</Text>
          </View>
          
          <View style={styles.tripDetails}>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Pickup:</Text> {currentTrip.pickup_address}
            </Text>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Dropoff:</Text> {currentTrip.drop_address}
            </Text>
            <View style={styles.fareContainer}>
              <Text style={styles.fareLabel}>Collect Fare</Text>
              <Text style={styles.fareAmount}>₹{currentTrip.total_customer_fare.toFixed(0)}</Text>
            </View>
          </View>

          {/* Navigate Button */}
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={() => {
              if (currentTrip.status === 'ride_started') {
                openNavigation(currentTrip.drop_lat, currentTrip.drop_lng, 'Drop');
              } else {
                openNavigation(currentTrip.pickup_lat, currentTrip.pickup_lng, 'Pickup');
              }
            }}
          >
            <Text style={styles.navigateBtnText}>
              🗺️ {currentTrip.status === 'ride_started' ? 'NAVIGATE TO DROP' : 'NAVIGATE TO PICKUP'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              currentTrip.status === 'accepted' ? styles.btnArrived :
              currentTrip.status === 'driver_arrived' ? styles.btnStart :
              styles.btnComplete
            ]}
            onPress={handleAction}
          >
            <Text style={styles.actionText}>
              {currentTrip.status === 'accepted' ? 'I HAVE ARRIVED' :
               currentTrip.status === 'driver_arrived' ? 'START RIDE (ENTER OTP)' :
               'COMPLETE TRIP'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.driver?.total_rides || 0}</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⭐ {user?.driver?.rating?.toFixed(1) || '5.0'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {currentLocation ? `${currentLocation.latitude.toFixed(4)}` : '--'}
              </Text>
              <Text style={styles.statLabel}>Lat</Text>
            </View>
          </View>

          {/* Go Online/Offline Toggle */}
          <TouchableOpacity
            style={[styles.toggleButton, isOnline ? styles.goOffline : styles.goOnline]}
            onPress={handleToggle}
            activeOpacity={0.8}
          >
            <Text style={styles.toggleEmoji}>{isOnline ? '🔴' : '🟢'}</Text>
            <Text style={styles.toggleText}>
              {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Incoming Ride Modal */}
      <Modal
        visible={!!activeRequest}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>🔔</Text>
              <Text style={styles.modalTitle}>New Trip Request!</Text>
            </View>
            
            <View style={styles.tripDetails}>
              <Text style={styles.detailText}>
                <Text style={styles.boldText}>Pickup:</Text> {activeRequest?.pickup_address}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.boldText}>Dropoff:</Text> {activeRequest?.drop_address}
              </Text>
              <Text style={styles.detailText}>
                <Text style={styles.boldText}>Distance to Pick-up:</Text> {activeRequest?.distance_to_pickup.toFixed(1)} km
              </Text>
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabel}>Your Earning</Text>
                <Text style={[styles.fareAmount, {color: '#f59e0b'}]}>₹{activeRequest?.driver_earning?.toFixed(0) || '—'}</Text>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:4}}>
                <Text style={{fontSize:12,color:'#94a3b8'}}>Customer pays</Text>
                <Text style={{fontSize:12,color:'#94a3b8'}}>₹{activeRequest?.estimated_fare.toFixed(0)}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.rejectBtn]} onPress={rejectRide}>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.acceptBtn]} onPress={acceptRide}>
                <Text style={styles.acceptText}>ACCEPT TRIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal visible={showOtpModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Customer OTP</Text>
            <Text style={{ color: '#64748b', marginBottom: 20 }}>
              Ask the customer for the 4-digit OTP to start the trip.
            </Text>
            {/* Quick hack: use Text layout for TextInput replacement without needing import if we forgot to import TextInput, wait, I'll use simple buttons if we don't have TextInput, but I should import TextInput... */}
            <Text style={{fontSize: 24, padding: 10, borderWidth: 1, borderColor: '#ccc', textAlign: 'center', marginBottom: 20}}>
              {enteredOtp || 'Tap numbers below'}
            </Text>
            
            {/* Custom Numpad */}
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center'}}>
              {[1,2,3,4,5,6,7,8,9,0].map(n => (
                <TouchableOpacity key={n} style={{padding: 20, backgroundColor: '#f1f5f9', borderRadius: 8}} onPress={() => setEnteredOtp(prev => prev + n)}>
                  <Text style={{fontSize: 24}}>{n}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{padding: 20, backgroundColor: '#f1f5f9', borderRadius: 8}} onPress={() => setEnteredOtp(prev => prev.slice(0, -1))}>
                <Text style={{fontSize: 24}}>DEL</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.modalBtn, styles.rejectBtn]} onPress={() => setShowOtpModal(false)}>
                <Text style={styles.rejectText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.acceptBtn]} onPress={handleVerifyOtp}>
                <Text style={styles.acceptText}>START</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Payment Modal */}
      <Modal visible={!!qrData} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {alignItems: 'center'}]}>
            <Text style={styles.modalTitle}>Show QR to Customer</Text>
            <Text style={{color: '#64748b', marginBottom: 20, textAlign: 'center'}}>
              Customer scans this QR to pay for the ride
            </Text>
            {qrData && (
              <View style={{backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20}}>
                <QRCode value={qrData} size={200} />
              </View>
            )}
            <Text style={{fontSize: 20, fontWeight: '800', color: '#16a34a', marginBottom: 20}}>
              ₹{qrData ? JSON.parse(qrData).amount?.toFixed(0) : '—'}
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, styles.acceptBtn, {width: '100%'}]}
              onPress={clearQr}
            >
              <Text style={styles.acceptText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  subGreeting: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 24,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e2e8f0',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 10,
    borderRadius: 16,
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  goOnline: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
  },
  goOffline: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  toggleEmoji: {
    fontSize: 20,
  },
  toggleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  tripDetails: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  detailText: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 10,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  fareContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#16a34a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#16a34a',
    flex: 2,
  },
  rejectBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rejectText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
  },
  activeTripBoard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  tripBoardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripBoardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  tripBoardCode: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  btnArrived: {
    backgroundColor: '#eab308', // Yellow
    shadowColor: '#eab308',
  },
  btnStart: {
    backgroundColor: '#3b82f6', // Blue
    shadowColor: '#3b82f6',
  },
  btnComplete: {
    backgroundColor: '#16a34a', // Green
    shadowColor: '#16a34a',
  },
  navigateBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  navigateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
