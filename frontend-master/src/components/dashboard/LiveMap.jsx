import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import axios from 'axios';
import config from '../../config';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '350px',
  borderRadius: '12px'
};

const center = {
  lat: 13.3409,
  lng: 74.7421
};

// Dark style for Google Maps
const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

/* ── Dark placeholder while map loads ─── */
const MapPlaceholder = () => (
  <div style={{
    width: '100%', height: '100%', minHeight: 350,
    background: '#1a1f2e', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 12,
  }}>
    <div style={{
      width: 32, height: 32, border: '3px solid rgba(245,158,11,0.3)',
      borderTopColor: '#f59e0b', borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <span style={{ color: '#64748b', fontSize: 13 }}>Loading map...</span>
  </div>
);

const LiveMap = () => {
    const [stands, setStands] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [selectedStand, setSelectedStand] = useState(null);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [mapReady, setMapReady] = useState(false);
    const [mountKey, setMountKey] = useState(0);
    const mapRef = useRef(null);

    // Handle map load
    const onMapLoad = useCallback((map) => {
        mapRef.current = map;
        setMapReady(true);
    }, []);

    // Handle visibility change — trigger resize when tab becomes active
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && mapRef.current) {
                setTimeout(() => {
                    if (window.google && window.google.maps && mapRef.current) {
                        window.google.maps.event.trigger(mapRef.current, 'resize');
                    }
                }, 200);
            }
        };

        const handleFocus = () => {
            if (mapRef.current && window.google && window.google.maps) {
                window.google.maps.event.trigger(mapRef.current, 'resize');
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // Remount map when component mounts (e.g. navigating back to dashboard)
    useEffect(() => {
        setMountKey(prev => prev + 1);
    }, []);

    // Fetch stands only once
    useEffect(() => {
        const fetchStands = async () => {
            try {
                const response = await axios.get(`${config.opsApiBase}/stands/`);
                if (response.data?.success && Array.isArray(response.data.data)) {
                    setStands(response.data.data);
                } else if (Array.isArray(response.data)) {
                    setStands(response.data);
                }
            } catch (error) {
                console.error("Failed to load auto stands", error);
            }
        };
        fetchStands();
    }, []);

    // Polling active drivers every 3 seconds
    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                const response = await axios.get(`${config.opsApiBase}/drivers/`);
                if (response.data?.drivers) {
                    const onlineDrivers = response.data.drivers.filter(d => 
                        d.is_online === true && d.current_lat && d.current_lng
                    );
                    setDrivers(onlineDrivers);
                }
            } catch (error) {
                console.error("Failed to load drivers", error);
            }
        };

        fetchDrivers();
        const intervalId = setInterval(fetchDrivers, 3000);
        return () => clearInterval(intervalId);
    }, []);

    return (
        <LoadScript
            googleMapsApiKey={config.googleMapsApiKey}
            loadingElement={<MapPlaceholder />}
        >
            <GoogleMap
                key={mountKey}
                mapContainerStyle={containerStyle}
                center={center}
                zoom={13}
                onLoad={onMapLoad}
                options={{
                  styles: mapStyles,
                  disableDefaultUI: false,
                  zoomControl: true,
                }}
            >
                {stands.map(stand => (
                    <Marker 
                        key={stand.id} 
                        position={{ lat: Number(stand.latitude), lng: Number(stand.longitude) }}
                        onClick={() => { setSelectedStand(stand); setSelectedDriver(null); }}
                        icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    />
                ))}

                {/* Render Drivers */}
                {drivers.map(driver => (
                    <Marker
                        key={`driver-${driver.driver_id}`}
                        position={{ lat: Number(driver.current_lat), lng: Number(driver.current_lng) }}
                        onClick={() => { setSelectedDriver(driver); setSelectedStand(null); }}
                        icon={window.google && window.google.maps && window.google.maps.Size ? {
                            url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" fill="#f59e0b" />
                                  <text x="12" y="16" font-size="12" text-anchor="middle" fill="#fff">🛺</text>
                                </svg>
                            `),
                            scaledSize: new window.google.maps.Size(32, 32),
                            anchor: new window.google.maps.Point(16, 16),
                        } : {
                            url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                        }}
                    />
                ))}

                {/* Info Windows */}
                {selectedStand && (
                    <InfoWindow
                        position={{ lat: Number(selectedStand.latitude), lng: Number(selectedStand.longitude) }}
                        onCloseClick={() => setSelectedStand(null)}
                    >
                        <div style={{ color: '#333', padding: '5px' }}>
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>{selectedStand.name}</h4>
                            <p style={{ margin: '0', fontSize: '12px' }}>ID: {selectedStand.id}</p>
                            <span style={{ 
                                display: 'inline-block', marginTop: '5px', padding: '2px 6px', 
                                background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontSize: '11px' 
                            }}>
                                Verified AP Stand
                            </span>
                        </div>
                    </InfoWindow>
                )}

                {selectedDriver && (
                    <InfoWindow
                        position={{ lat: Number(selectedDriver.current_lat), lng: Number(selectedDriver.current_lng) }}
                        onCloseClick={() => setSelectedDriver(null)}
                    >
                        <div style={{ color: '#333', padding: '5px' }}>
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>🛺 {selectedDriver.name}</h4>
                            <p style={{ margin: '0', fontSize: '12px' }}>Plate: {selectedDriver.vehicle_registration}</p>
                            <p style={{ margin: '0', fontSize: '12px' }}>Rating: ⭐ {selectedDriver.rating}</p>
                            <span style={{ 
                                display: 'inline-block', marginTop: '5px', padding: '2px 6px', 
                                background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '11px' 
                            }}>
                                Active Driver
                            </span>
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
        </LoadScript>
    );
};

export default LiveMap;
