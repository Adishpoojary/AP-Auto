import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, SafeAreaView, Dimensions, Platform, ActivityIndicator, Linking } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Config from './constants/Config';

const { width, height } = Dimensions.get('window');

// The Test Customer token generated in the backend
const CUSTOMER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwicm9sZSI6ImN1c3RvbWVyIiwiZXhwIjoxNzc5MjEyNTIxLCJpYXQiOjE3NzY2MjA1MjF9.UUxwOtbXCi-Z93QhxVrlhtKevf-Qm3re-s4StFA28m0";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export default function App() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  
  const [viewState, setViewState] = useState<'IDLE' | 'ESTIMATING' | 'BOOKING' | 'WAITING' | 'ACCEPTED' | 'PAYMENT' | 'SCANNING'>('IDLE');
  
  const [fareEstimate, setFareEstimate] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Permission to access location was denied');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      
      // Reverse geocode to get place name
      let addressName = "Current Location";
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geocode.length > 0) {
          const place = geocode[0];
          addressName = place.name || place.street || place.district || place.city || "Current Location";
        }
      } catch (e) {
        console.log('Reverse geocode failed:', e);
      }
      
      setPickup({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addressName
      });
      
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    })();
  }, []);

  const handleDropoffSelect = async (data: any, details: any) => {
    const lat = details.geometry.location.lat;
    const lng = details.geometry.location.lng;
    
    setDropoff({
      latitude: lat,
      longitude: lng,
      address: data.description
    });
    
    if (pickup) {
      mapRef.current?.fitToCoordinates([
        { latitude: pickup.latitude, longitude: pickup.longitude },
        { latitude: lat, longitude: lng }
      ], {
        edgePadding: { top: 150, right: 50, bottom: 400, left: 50 },
        animated: true,
      });
    }

    getFareEstimate(pickup!.latitude, pickup!.longitude, lat, lng);
  };

  const getFareEstimate = async (pLat: number, pLng: number, dLat: number, dLng: number) => {
    setViewState('ESTIMATING');
    try {
      const res = await axios.post(`${Config.API_URL}${Config.API_PREFIX}/rides/estimate`, {
        pickup_lat: pLat,
        pickup_lng: pLng,
        drop_lat: dLat,
        drop_lng: dLng,
      }, {
        headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
      });
      
      if (res.data.success) {
        setFareEstimate(res.data.data.fare);
        setViewState('BOOKING');
      } else {
        Alert.alert("Notice", res.data.message);
        setViewState('IDLE');
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Could not get estimate");
      setViewState('IDLE');
    }
  };

  const confirmBooking = async () => {
    if (!pickup || !dropoff) return;
    setViewState('WAITING');
    
    try {
      const res = await axios.post(`${Config.API_URL}${Config.API_PREFIX}/rides/request`, {
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        pickup_address: pickup.address,
        drop_lat: dropoff.latitude,
        drop_lng: dropoff.longitude,
        drop_address: dropoff.address
      }, {
        headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
      });
      
      if (res.data.success) {
        setActiveRide(res.data.data);
        pollRideStatus(res.data.data.ride_id);
      }
    } catch (e: any) {
      Alert.alert("Failed", e.response?.data?.detail || "No drivers available");
      setViewState('BOOKING');
    }
  };

  const pollRideStatus = async (rideId: number) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${Config.API_URL}${Config.API_PREFIX}/rides/${rideId}`, {
          headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
        });
        const status = res.data.data.status;
        setActiveRide(res.data.data);
        
        if (status === 'accepted' || status === 'driver_arrived' || status === 'ride_started') {
          setViewState('ACCEPTED');
        } else if (status === 'ride_completed') {
          setViewState('PAYMENT');
          clearInterval(interval);
        } else if (status === 'no_driver_found' || status === 'cancelled') {
          setViewState('IDLE');
          clearInterval(interval);
          Alert.alert("Sorry", "No driver accepted your ride.");
        }
      } catch (e) {}
    }, 3000);
  };

  // Dark Premium Map Style (Uber-inspired)
  const customMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#22223a" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6a6a7a" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1e2d1e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a40" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a55" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#7a7a8a" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#22223a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5568" }] }
  ];

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View style={styles.webMapFallback}>
          <Text style={{fontSize: 50}}>🗺️</Text>
          <Text style={{fontSize: 18, color: '#64748b', marginTop: 10}}>Map view is optimized for Mobile.</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={true}
          showsMyLocationButton={false}
          customMapStyle={customMapStyle}
        >
          {pickup && (
            <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }}>
              <View style={styles.pickupPin}>
                <View style={styles.pickupPinInner} />
              </View>
            </Marker>
          )}
          
          {dropoff && (
            <Marker coordinate={{ latitude: dropoff.latitude, longitude: dropoff.longitude }}>
              <View style={styles.dropoffPin}>
                <Ionicons name="location" size={24} color="#fff" />
              </View>
            </Marker>
          )}

          {pickup && dropoff && (
            <Polyline
              coordinates={[
                { latitude: pickup.latitude, longitude: pickup.longitude },
                { latitude: dropoff.latitude, longitude: dropoff.longitude }
              ]}
              strokeColor="#f59e0b"
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
        </MapView>
      )}

      {/* Floating Header UI */}
      <SafeAreaView style={styles.headerLayer} pointerEvents="box-none">
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBadge}>
            <Text style={styles.profileText}>AP</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Interface */}
      {viewState === 'IDLE' && (
        <View style={styles.bottomCard}>
          <Text style={styles.greetingText}>Good Evening, Adish</Text>
          <Text style={styles.questionText}>Where would you like to go?</Text>
          
          <View style={styles.searchBoxLayer}>
            <Ionicons name="search" size={20} color="#94a3b8" style={{marginLeft: 15, marginTop: 16}} />
            <GooglePlacesAutocomplete
              placeholder='Search destination...'
              fetchDetails={true}
              onPress={handleDropoffSelect}
              query={{
                key: Config.GOOGLE_MAPS_API_KEY,
                language: 'en',
                components: 'country:in',
                location: location ? `${location.coords.latitude},${location.coords.longitude}` : '13.3409,74.7421',
                radius: 30000,
                strictbounds: true,
              }}
              enablePoweredByContainer={false}
              minLength={2}
              debounce={300}
              styles={{
                container: { flex: 1 },
                textInputContainer: { backgroundColor: 'transparent' },
                textInput: {
                  height: 52,
                  fontSize: 16,
                  backgroundColor: 'transparent',
                  fontWeight: '500',
                  color: '#e2e8f0'
                },
                listView: {
                  position: 'absolute',
                  top: 60,
                  backgroundColor: '#1e1e32',
                  borderRadius: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  elevation: 10,
                  zIndex: 999
                },
                row: { backgroundColor: 'transparent', paddingVertical: 14 },
                separator: { backgroundColor: 'rgba(255,255,255,0.06)' },
                description: { color: '#e2e8f0', fontSize: 14 },
                predefinedPlacesDescription: { color: '#f59e0b' },
              }}
              textInputProps={{
                placeholderTextColor: '#6a6a7a',
              }}
            />
          </View>

          {/* Quick Destination Chips */}
          <Text style={{color:'#6a6a7a',fontSize:12,fontWeight:'600',marginTop:20,marginBottom:10,letterSpacing:1}}>POPULAR DESTINATIONS</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {[
              {name:'Manipal',lat:13.3525,lng:74.7928},
              {name:'Santhekatte',lat:13.3233,lng:74.7861},
              {name:'Udupi Bus Stand',lat:13.3389,lng:74.7451},
              {name:'MIT Manipal',lat:13.3524,lng:74.7930},
              {name:'Malpe Beach',lat:13.3493,lng:74.7069},
              {name:'Diana Circle',lat:13.3379,lng:74.7483},
            ].map((place,i) => (
              <TouchableOpacity key={i} style={{backgroundColor:'rgba(255,255,255,0.06)',paddingHorizontal:14,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,0.08)'}}
                onPress={() => {
                  setDropoff({ latitude: place.lat, longitude: place.lng, address: place.name });
                  if (pickup) {
                    mapRef.current?.fitToCoordinates([
                      { latitude: pickup.latitude, longitude: pickup.longitude },
                      { latitude: place.lat, longitude: place.lng }
                    ], { edgePadding: { top: 150, right: 50, bottom: 400, left: 50 }, animated: true });
                  }
                  getFareEstimate(pickup!.latitude, pickup!.longitude, place.lat, place.lng);
                }}
              >
                <Text style={{color:'#e2e8f0',fontSize:13,fontWeight:'600'}}>📍 {place.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.recentLocations}>
            <TouchableOpacity style={styles.recentItem}>
              <View style={styles.recentIconBox}><Ionicons name="home" size={20} color="#f59e0b" /></View>
              <View>
                <Text style={styles.recentTitle}>Home</Text>
                <Text style={styles.recentSub}>Udupi, Karnataka</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {viewState === 'ESTIMATING' && (
        <View style={styles.bottomCard}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.calculatingText}>Calculating best route and fare...</Text>
        </View>
      )}

      {viewState === 'BOOKING' && fareEstimate && (
        <View style={styles.bottomCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.rideOptionsTitle}>Select your ride</Text>
          
          <View style={styles.rideOptionCard}>
            <View style={styles.rideOptionLeft}>
              <Text style={{fontSize: 40}}>🛺</Text>
              <View style={{marginLeft: 16}}>
                <Text style={styles.rideName}>AP Auto</Text>
                <Text style={styles.rideTime}>{fareEstimate.estimated_duration_min} min • 3 seats</Text>
              </View>
            </View>
            <Text style={styles.ridePrice}>₹{fareEstimate.total_customer_fare.toFixed(0)}</Text>
          </View>
          
          <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.confirmBtn}>
            <TouchableOpacity style={{width: '100%', alignItems: 'center'}} onPress={confirmBooking}>
              <Text style={styles.confirmBtnText}>Confirm AP Auto</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {viewState === 'WAITING' && (
        <View style={styles.bottomCard}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.rideOptionsTitle}>🛺 Finding your auto...</Text>
          <Text style={styles.calculatingText}>
            Assigning the nearest driver to you.{'\n'}
            Your captain will accept any moment!
          </Text>
          <View style={{backgroundColor:'rgba(245,158,11,0.1)',padding:14,borderRadius:14,marginTop:14,borderWidth:1,borderColor:'rgba(245,158,11,0.2)'}}>
            <Text style={{color:'#f59e0b',fontSize:13,textAlign:'center',fontWeight:'600'}}>
              ⚡ Instant match — assigning nearest available driver
            </Text>
          </View>
        </View>
      )}

      {viewState === 'ACCEPTED' && activeRide && (
        <View style={styles.bottomCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.rideOptionsTitle}>Your Captain is on the way!</Text>
          
          <View style={styles.driverInfoCard}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={{marginLeft: 16}}>
                <Text style={styles.driverName}>{activeRide.driver?.name || 'Driver'}</Text>
                <Text style={styles.vehicleInfo}>★ {activeRide.driver?.rating || '5.0'} • {activeRide.driver?.vehicle_make || 'Bajaj RE'}</Text>
              </View>
            </View>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{activeRide.driver?.vehicle_registration || 'AP-01-XX'}</Text>
            </View>
          </View>

          <View style={styles.otpSection}>
            <Text style={styles.otpMessage}>Give this PIN to the driver</Text>
            <View style={styles.otpDisplay}>
              <Text style={styles.otpNumber}>{activeRide.ride_otp}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Payment Screen */}
      {viewState === 'PAYMENT' && activeRide && (
        <View style={styles.bottomCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.rideOptionsTitle}>💳 Payment</Text>
          <Text style={{color: '#8a8a9a', marginBottom: 16}}>Ride completed! Pay the fare below.</Text>
          
          <View style={[styles.rideOptionCard, {borderColor: '#16a34a'}]}>
            <View>
              <Text style={{color: '#8a8a9a', fontSize: 13}}>Total Fare</Text>
              <Text style={{color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4}}>₹{activeRide.total_customer_fare?.toFixed(0)}</Text>
            </View>
            <Text style={{color: '#8a8a9a', fontSize: 13}}>Ride: {activeRide.booking_code}</Text>
          </View>

          <TouchableOpacity
            style={{backgroundColor: 'rgba(59,130,246,0.15)', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)'}}
            onPress={async () => {
              if (!cameraPermission?.granted) {
                await requestCameraPermission();
              }
              setViewState('SCANNING');
            }}
          >
            <Ionicons name="scan" size={24} color="#3b82f6" />
            <Text style={{color: '#3b82f6', fontWeight: '700', fontSize: 15, marginTop: 6}}>SCAN DRIVER QR CODE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{backgroundColor: 'rgba(245,158,11,0.15)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)'}}
            onPress={async () => {
              try {
                await axios.post(`${Config.API_URL}${Config.API_PREFIX}/rides/${activeRide.id}/pay-cash`, {}, {
                  headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
                });
                Alert.alert('✅ Payment Done', `Cash payment of ₹${activeRide.total_customer_fare?.toFixed(0)} confirmed.`);
                setViewState('IDLE');
                setActiveRide(null);
                setDropoff(null);
              } catch(e) {
                Alert.alert('Error', 'Could not process payment');
              }
            }}
          >
            <Ionicons name="cash" size={24} color="#f59e0b" />
            <Text style={{color: '#f59e0b', fontWeight: '700', fontSize: 15, marginTop: 6}}>PAY CASH</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* QR Scanner */}
      {viewState === 'SCANNING' && (
        <View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 100}}>
          <CameraView
            style={{flex: 1}}
            barcodeScannerSettings={{barcodeTypes: ['qr']}}
            onBarcodeScanned={(result) => {
              try {
                const data = JSON.parse(result.data);
                setScannedData(data);
                setViewState('PAYMENT');
                Alert.alert(
                  '✅ QR Scanned!',
                  `Ride: ${data.booking_code}\nAmount: ₹${data.amount?.toFixed(0)}`,
                  [
                    {
                      text: 'Pay Cash', onPress: async () => {
                        try {
                          await axios.post(`${Config.API_URL}${Config.API_PREFIX}/rides/${data.ride_id}/pay-cash`, {}, {
                            headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
                          });
                          Alert.alert('✅ Done', 'Cash payment confirmed!');
                          setViewState('IDLE');
                          setActiveRide(null);
                          setDropoff(null);
                        } catch(e) {
                          Alert.alert('Error', 'Payment failed');
                        }
                      }
                    },
                    { text: 'Cancel', style: 'cancel', onPress: () => setViewState('PAYMENT') }
                  ]
                );
              } catch (e) {
                Alert.alert('Invalid QR', 'Could not read QR code');
                setViewState('PAYMENT');
              }
            }}
          />
          <TouchableOpacity
            style={{position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 24}}
            onPress={() => setViewState('PAYMENT')}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center'}}>
            <Text style={{color: '#fff', fontSize: 16, fontWeight: '600'}}>Point camera at driver's QR code</Text>
          </View>
        </View>
      )}

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  map: { width: width, height: height },
  webMapFallback: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  
  // Custom Pins
  pickupPin: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245, 158, 11, 0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#f59e0b'
  },
  pickupPinInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#f59e0b' },
  dropoffPin: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10
  },

  // Header UI
  headerLayer: { position: 'absolute', top: 0, width: '100%', zIndex: 10 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10 },
  menuButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(30,30,50,0.85)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
  },
  profileBadge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f59e0b',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5
  },
  profileText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Bottom UI
  bottomCard: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: '#16162a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  dragHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  greetingText: { fontSize: 26, fontWeight: '800', color: '#ffffff' },
  questionText: { fontSize: 15, color: '#8a8a9a', marginTop: 4, marginBottom: 20 },
  
  searchBoxLayer: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 99
  },
  
  recentLocations: { marginTop: 24, zIndex: 1 },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  recentIconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  recentTitle: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  recentSub: { fontSize: 13, color: '#6a6a7a', marginTop: 2 },

  // Booking UI
  rideOptionsTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 16 },
  rideOptionCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.08)', padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#f59e0b', marginBottom: 24
  },
  rideOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  rideName: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  rideTime: { fontSize: 13, color: '#8a8a9a', marginTop: 2 },
  ridePrice: { fontSize: 24, fontWeight: '800', color: '#f59e0b' },
  
  confirmBtn: { paddingVertical: 18, borderRadius: 16, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  confirmBtnText: { color: '#0f0f1a', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  
  calculatingText: { fontSize: 15, color: '#8a8a9a', textAlign: 'center', marginTop: 16 },

  // Driver Info
  driverInfoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  vehicleInfo: { fontSize: 14, color: '#8a8a9a', marginTop: 2 },
  plateBadge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  plateText: { fontSize: 13, fontWeight: '800', color: '#f59e0b', letterSpacing: 1 },
  
  otpSection: { alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.08)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  otpMessage: { fontSize: 14, color: '#f59e0b', fontWeight: '600', marginBottom: 8 },
  otpDisplay: { backgroundColor: '#1e1e32', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  otpNumber: { fontSize: 32, fontWeight: '800', color: '#f59e0b', letterSpacing: 8 }
});
