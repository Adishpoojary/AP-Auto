import React, { useState, useCallback, useRef, useEffect } from 'react';
// 3-Tier Zoom Rendering: District View (< 10) → Clustering (10-14) → Street View (15+)
import { GoogleMap, Marker, InfoWindow, Polygon, Polyline } from '@react-google-maps/api';
import { Clusterer } from '@react-google-maps/marker-clusterer';
import config from '../../../config';
import { useGoogleMaps } from '../../../context/GoogleMapsProvider';

import { getDriverIcon, getBookingIcon, getDropIcon } from './markerIcons';



const containerStyle = {
    width: '100%',
    height: '100%',
};

// Default center (Bangalore)
const defaultCenter = {
    lat: 12.9716,
    lng: 77.5946,
};

const options = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
};

const createClusterSvg = (color) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
        <circle cx="25" cy="25" r="20" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-opacity="0.5" stroke-width="1"/>
        <circle cx="25" cy="25" r="14" fill="${color}" fill-opacity="0.6"/>
        <circle cx="25" cy="25" r="10" fill="${color}" fill-opacity="0.9"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const getClusterStyles = (color, zIndex = 200) => {
    return [1, 2, 3, 4, 5].map(() => ({
        url: createClusterSvg(color),
        height: 50,
        width: 50,
        textColor: 'white',
        textSize: 14,
        zIndex,
    }));
};

const defaultClusterOptions = {
    gridSize: 80, // Increased from 60 to group markers that are slightly further apart
    minimumClusterSize: 2, // Decreased from 3 so pairs of markers will also group together
    maxZoom: 14,
};

const driverClusterOptions = {
    ...defaultClusterOptions,
    styles: getClusterStyles('#10B981', 200) // Green for drivers, high z-index
};

const bookingClusterOptions = {
    ...defaultClusterOptions,
    styles: getClusterStyles('#3B82F6', 100) // Blue for bookings, lower z-index
};

// Round lat/lng to 5 decimal places (~1m precision) for grouping co-located bookings
const locationKey = (lat, lng) => `${parseFloat(lat).toFixed(5)}_${parseFloat(lng).toFixed(5)}`;

// =========================
// Tier 1: District Stats Calculator — groups drivers/bookings by district for District View badges
// =========================
const calculateZoneStats = (drivers, bookings, districtMapping, showCompletedBookings) => {
    // Build district groups using the mapping from pincode_city table
    const districts = {};

    // Find nearest district by lat/lng — the authoritative way to assign drivers
    // (city_node in DB can be wrong, e.g. "Afzalpur" for a driver physically in Udupi)
    const getDistrictByLocation = (lat, lng) => {
        if (!districtMapping || isNaN(lat) || isNaN(lng)) return null;
        
        let bestDist = Infinity, bestEntry = null;
        // Maximum distance threshold squared (1.0 degree ≈ 111km radius)
        // Prevents international/out-of-bound locations from snapping to unrelated districts
        const MAX_DIST_SQUARED = 1.0;

        // Search across all mapped cities to find the closest one 
        // (better than snapping to nearest district center, which fails for large districts)
        Object.values(districtMapping).forEach(entry => {
            if (entry.lat && entry.lng) {
                const dist = Math.pow(lat - entry.lat, 2) + Math.pow(lng - entry.lng, 2);
                if (dist < bestDist) { bestDist = dist; bestEntry = entry; }
            }
        });
        
        return bestDist <= MAX_DIST_SQUARED ? bestEntry : null;
    };

    // Group drivers by district using their actual geographic location
    drivers.forEach(d => {
        const dLat = parseFloat(d.current_lat || d.base_lat);
        const dLng = parseFloat(d.current_lng || d.base_lng);
        const info = getDistrictByLocation(dLat, dLng);
        // When district mapping is available, use district name. Otherwise, normalize
        // base_location to Title Case so "udupi" and "Udupi" merge into one card.
        const rawFallback = (d.base_location || '').trim() || 'Unknown';
        const normalizedFallback = rawFallback.split(/\s+/).map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        const districtName = info ? info.district : normalizedFallback;

        if (!districts[districtName]) {
            // Use the node city's coords as the district center
            let centerLat = 0, centerLng = 0;
            if (info) {
                const nodeEntry = Object.values(districtMapping).find(
                    e => e.district === info.district && e.is_node
                );
                if (nodeEntry && nodeEntry.lat && nodeEntry.lng) {
                    centerLat = nodeEntry.lat;
                    centerLng = nodeEntry.lng;
                } else if (info.lat && info.lng) {
                    centerLat = info.lat;
                    centerLng = info.lng;
                }
            }
            districts[districtName] = {
                name: districtName,
                lat: centerLat,
                lng: centerLng,
                drivers: [],
                bookings: [],
                _hasFixedCenter: centerLat !== 0 && centerLng !== 0,
                _latSum: 0, _lngSum: 0, _count: 0,
            };
        }
        districts[districtName].drivers.push(d);

        // If no fixed center from mapping, average driver positions as fallback
        if (!districts[districtName]._hasFixedCenter) {
            if (!isNaN(dLat) && !isNaN(dLng)) {
                districts[districtName]._latSum += dLat;
                districts[districtName]._lngSum += dLng;
                districts[districtName]._count++;
            }
        }
    });

    // Group bookings by their actual district (using getDistrictByLocation, same as drivers)
    bookings.forEach(b => {
        if (b.state === 'Completed' && !showCompletedBookings) return;
        const bLat = parseFloat(b.pickup_lat);
        const bLng = parseFloat(b.pickup_lng || b.pickup_lon);
        if (isNaN(bLat) || isNaN(bLng)) return;

        // Use getDistrictByLocation to find the correct district (same method as drivers)
        const info = getDistrictByLocation(bLat, bLng);
        const districtName = info ? info.district : 'Other';

        // Create district card if it doesn't exist yet (booking-only districts)
        if (!districts[districtName]) {
            let centerLat = 0, centerLng = 0;
            if (info) {
                const nodeEntry = Object.values(districtMapping).find(
                    e => e.district === info.district && e.is_node
                );
                if (nodeEntry && nodeEntry.lat && nodeEntry.lng) {
                    centerLat = nodeEntry.lat;
                    centerLng = nodeEntry.lng;
                } else if (info.lat && info.lng) {
                    centerLat = info.lat;
                    centerLng = info.lng;
                }
            }
            districts[districtName] = {
                name: districtName,
                lat: centerLat,
                lng: centerLng,
                drivers: [],
                bookings: [],
                _hasFixedCenter: centerLat !== 0 && centerLng !== 0,
                _latSum: 0, _lngSum: 0, _count: 0,
            };
        }

        districts[districtName].bookings.push(b);
    });

    // Finalize center coords and compute stats (no merging needed — districts are natural boundaries)
    return Object.values(districts).map(z => {
        const totalDrivers = z.drivers.filter(d => d.driver_status !== 'registered').length;
        const availableDrivers = z.drivers.filter(d => d.driver_status === 'available').length;
        const totalBookings = z.bookings.length;
        const unassignedBookings = z.bookings.filter(b => {
            if (b.is_unassigned) return true;
            if (b.state === 'Pending') {
                const now = new Date();
                const pickupTime = new Date(b.pickup_time);
                return pickupTime < now && pickupTime.toDateString() !== now.toDateString();
            }
            return false;
        }).length;

        const assignedBookings = z.bookings.filter(b => {
            if (b.state === 'Assigned') return true;
            if (b.state === 'Pending' && !b.is_unassigned) {
                const now = new Date();
                const pickupTime = new Date(b.pickup_time);
                // Only count as 'assigned' in this context if it's NOT a historical pending booking
                const isHistoricalUnassigned = pickupTime < now && pickupTime.toDateString() !== now.toDateString();
                return !isHistoricalUnassigned;
            }
            return false;
        }).length;
        const fillRate = totalBookings > 0 ? Math.round(((totalBookings - unassignedBookings) / totalBookings) * 100) : 100;
        // Use fixed center or averaged driver positions
        const finalLat = z._hasFixedCenter ? z.lat : (z._count > 0 ? z._latSum / z._count : z.lat);
        const finalLng = z._hasFixedCenter ? z.lng : (z._count > 0 ? z._lngSum / z._count : z.lng);
        return {
            name: z.name,
            lat: finalLat,
            lng: finalLng,
            totalDrivers,
            availableDrivers,
            totalBookings,
            unassignedBookings,
            assignedBookings,
            fillRate,
        };
    });
};

const OpsMapView = ({ drivers, bookings, trips = [], selectedDriver, selectedBooking, onSelectDriver, onSelectBooking, mapViewport, onViewportChange, showServiceZone, showHotzones, showRealtimeHotzones, showHistoricalHotzones, showCriticalOnly, showCompletedBookings, districtMapping }) => {
    const { isLoaded, loadError } = useGoogleMaps();

    const [map, setMap] = useState(null);
    const hasFittedBounds = useRef(false);
    const [serviceZones, setServiceZones] = useState([]);
    const [hotzones, setHotzones] = useState([]);
    const [selectedHotzone, setSelectedHotzone] = useState(null);
    // All bookings at the clicked marker's location (for scrollable InfoWindow)
    const [selectedLocationBookings, setSelectedLocationBookings] = useState([]);
    // All drivers at the clicked marker's location (for scrollable InfoWindow)
    const [selectedLocationDrivers, setSelectedLocationDrivers] = useState([]);

    // Ref to always access latest bookings in marker click handlers (avoids stale closure)
    const bookingsRef = useRef(bookings);
    bookingsRef.current = bookings;
    // Ref to always access latest drivers in marker click handlers (avoids stale closure)
    const driversRef = useRef(drivers);
    driversRef.current = drivers;

    // Fetch serviceable zones once on mount
    useEffect(() => {
        const fetchServiceZones = async () => {
            try {
                const baseUrl = config.dispatchApiBase || 'http://localhost:8001/api';
                const response = await fetch(`${baseUrl}/zones/serviceable`);
                const data = await response.json();
                if (data.success && data.polygons) {
                    setServiceZones(data.polygons);
                }
            } catch (error) {
                console.error('Error fetching service zones:', error);
            }
        };
        fetchServiceZones();
    }, []);

    // Fetch hotzones periodically
    useEffect(() => {
        const fetchHotzones = async () => {
            try {
                const baseUrl = config.dispatchApiBase || 'http://localhost:8001/api';
                const response = await fetch(`${baseUrl}/ops/hotzones`);
                const data = await response.json();
                if (data.success && data.hotzones) {
                    setHotzones(data.hotzones);
                }
            } catch (error) {
                console.error('Error fetching hotzones:', error);
            }
        };

        // Fetch immediately, then every 60s
        fetchHotzones();
        const intervalId = setInterval(fetchHotzones, 60000);
        return () => clearInterval(intervalId);
    }, []);

    // Track which booking we've already auto-zoomed to, to avoid fighting with user panning or data refreshes
    const lastZoomedBookingId = useRef(null);

    // Pan map to selected driver or booking when selection changes (e.g. from sidebar click)
    React.useEffect(() => {
        if (!map) return;
        if (selectedDriver) {
            const lat = parseFloat(selectedDriver.current_lat);
            const lng = parseFloat(selectedDriver.current_lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.panTo({ lat, lng });
                // Ensure zoom is at least 15 to see markers clearly
                if (map.getZoom() < 15) map.setZoom(15);
                lastZoomedBookingId.current = null; // Clear booking zoom lock
            }
        } else if (selectedBooking) {
            const bookingId = selectedBooking.id || selectedBooking.booking_id;
            
            // Only auto-zoom if this is a NEW selection to prevent fighting user's manual pans/zooms
            if (lastZoomedBookingId.current === bookingId) return;
            lastZoomedBookingId.current = bookingId;

            const pLat = parseFloat(selectedBooking.pickup_lat);
            const pLng = parseFloat(selectedBooking.pickup_lng || selectedBooking.pickup_lon);
            const dLat = parseFloat(selectedBooking.drop_lat);
            const dLng = parseFloat(selectedBooking.drop_lng || selectedBooking.drop_lon);

            if (!isNaN(pLat) && !isNaN(pLng)) {
                if (!isNaN(dLat) && !isNaN(dLng) && (Math.abs(pLat - dLat) > 0.0001 || Math.abs(pLng - dLng) > 0.0001)) {
                    // Create bounds to fit both points if they are distinct
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend({ lat: pLat, lng: pLng });
                    bounds.extend({ lat: dLat, lng: dLng });

                    // fitBounds automatically zooms and pans
                    // Use padding object for more precise control
                    map.fitBounds(bounds, { top: 100, bottom: 100, left: 100, right: 100 });

                    // Cap zoom level so it doesn't get too tight for close points
                    window.google.maps.event.addListenerOnce(map, 'idle', () => {
                        if (map.getZoom() > 16) map.setZoom(16);
                    });
                } else {
                    // Just pan to pickup if drop is missing or identical
                    map.panTo({ lat: pLat, lng: pLng });
                    if (map.getZoom() < 16) map.setZoom(16);
                }
            }
        } else {
            lastZoomedBookingId.current = null;
        }
    }, [map, selectedDriver, selectedBooking]);

    // Update local location-based selection state when props change (from sidebar click)
    useEffect(() => {
        if (selectedDriver) {
            const lat = parseFloat(selectedDriver.current_lat);
            const lng = parseFloat(selectedDriver.current_lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                const key = locationKey(lat, lng);
                const coLocated = driversRef.current.filter(d => {
                    const dLat = parseFloat(d.current_lat);
                    const dLng = parseFloat(d.current_lng);
                    return locationKey(dLat, dLng) === key;
                });
                setSelectedLocationDrivers(coLocated);
                setSelectedLocationBookings([]);
            }
        } else if (selectedBooking) {
            const lat = parseFloat(selectedBooking.pickup_lat);
            const lng = parseFloat(selectedBooking.pickup_lng || selectedBooking.pickup_lon);
            if (!isNaN(lat) && !isNaN(lng)) {
                const key = locationKey(lat, lng);
                const urgencyScore = (b) => {
                    if (b.is_unassigned) return 0;
                    const st = b.state;
                    if (st === 'Delayed') return 1;
                    if (st === 'Pending') return 2;
                    if (st === 'Assigned') return 3;
                    return 4;
                };
                const coLocated = bookingsRef.current
                    .filter(b => {
                        const bLat = parseFloat(b.pickup_lat);
                        const bLng = parseFloat(b.pickup_lng || b.pickup_lon);
                        return locationKey(bLat, bLng) === key;
                    })
                    .sort((a, b) => urgencyScore(a) - urgencyScore(b));
                setSelectedLocationBookings(coLocated);
                setSelectedLocationDrivers([]);
            }
        } else {
            // No selection - clear location states (but keep logic if InfoWindow should stay open?)
            // Usually, clicking the map background calls onSelect(null), so this is fine.
            setSelectedLocationDrivers([]);
            setSelectedLocationBookings([]);
        }
    }, [selectedDriver, selectedBooking]);

    const onLoad = useCallback(function callback(mapInstance) {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    // ---- Marker diffing: maintain pools instead of destroy/rebuild every poll ----
    const driverMarkerPool = useRef(new Map()); // driver_id → { marker, listener }
    const bookingMarkerPool = useRef(new Map()); // booking.id → { marker, listener, pulseDiv }
    const driverClustererRef = useRef(null);
    const bookingClustererRef = useRef(null);
    const currentZoom = useRef(11);
    const [zoom, setZoom] = useState(11); // Reactive zoom for conditional rendering
    const prevUrgencyRef = useRef(new Map()); // booking.id → was urgent last render (for bounce-on-entry)
    const zoneBadgePool = useRef([]); // ZoneBadge overlay instances
    // eslint-disable-next-line no-unused-vars
    const hotzonePolygonPool = useRef(new Map()); // hotzone_id → google.maps.Polygon (Phase 2: polygon caching)

    // Animation state for smooth marker movement
    const markerAnimations = useRef(new Map()); // id -> { requestID, startTime, fromPos, toPos }

    // Helper: Quadratic easing function for smoother transitions
    const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const animateMarker = useCallback((id, marker, toPos, duration = 3000) => {
        const fromPos = marker.getPosition();
        if (!fromPos || (Math.abs(fromPos.lat() - toPos.lat) < 0.000001 && Math.abs(fromPos.lng() - toPos.lng) < 0.000001)) {
            marker.setPosition(toPos);
            return;
        }

        // Cancel existing animation for this marker
        if (markerAnimations.current.has(id)) {
            cancelAnimationFrame(markerAnimations.current.get(id).requestID);
        }

        const startTime = performance.now();
        const startLat = fromPos.lat();
        const startLng = fromPos.lng();

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutQuad(progress);

            const currentLat = startLat + (toPos.lat - startLat) * easedProgress;
            const currentLng = startLng + (toPos.lng - startLng) * easedProgress;

            marker.setPosition({ lat: currentLat, lng: currentLng });

            if (progress < 1) {
                const requestID = requestAnimationFrame(step);
                markerAnimations.current.set(id, { requestID });
            } else {
                markerAnimations.current.delete(id);
            }
        };

        const requestID = requestAnimationFrame(step);
        markerAnimations.current.set(id, { requestID });
    }, []);

    // Cleanup animations on unmount
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            markerAnimations.current.forEach(anim => cancelAnimationFrame(anim.requestID));
            markerAnimations.current.clear();
        };
    }, []);

    // Inject CSS for pulsing ring animation (once)
    useEffect(() => {
        if (document.getElementById('ops-pulse-style')) return;
        const style = document.createElement('style');
        style.id = 'ops-pulse-style';
        style.textContent = `
            @keyframes ops-pulse-ring {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.7; }
                100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
            }
            .ops-pulse-ring {
                position: absolute;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                animation: ops-pulse-ring 2.5s ease-out infinite;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }, []);

    // Track zoom level for zoom-based rendering
    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('zoom_changed', () => {
            const z = map.getZoom();
            currentZoom.current = z;
            setZoom(z);
        });
        return () => window.google.maps.event.removeListener(listener);
    }, [map]);

    // =========================
    // Global handleDriverFocus for Syncing Table clicks
    // =========================
    useEffect(() => {
        window.handleDriverFocus = (trip) => {
            if (!map) return;
            
            let targetDriverId = trip.driver_id;
            let targetDriver = null;
            
            if (targetDriverId) {
                targetDriver = driversRef.current.find(d => (d.driver_id || d.id) === targetDriverId);
            }
            if (!targetDriver && trip.driver_name) {
                targetDriver = driversRef.current.find(d => d.driver_name === trip.driver_name);
            }
            
            if (targetDriver) {
                targetDriverId = targetDriver.driver_id || targetDriver.id;
            } else {
                targetDriverId = trip.driver_id || trip.driver_name;
            }

            const focus = (retryCount = 0) => {
                const poolItem = driverMarkerPool.current.get(targetDriverId);
                const marker = poolItem ? poolItem.marker : null;
                
                if (marker) {
                    map.panTo(marker.getPosition());
                    map.setZoom(16);
                    window.google.maps.event.trigger(marker, 'click');
                } else if (retryCount < 3) {
                    setTimeout(() => focus(retryCount + 1), 400);
                }
            };
            
            focus();
        };
        
        return () => {
            delete window.handleDriverFocus;
        };
    }, [map]);

    // =========================
    // Tier 1: Toggle cluster/marker visibility based on zoom
    // =========================
    useEffect(() => {
        const showMarkers = zoom >= 10;

        // Toggle driver markers
        driverMarkerPool.current.forEach(({ marker }) => {
            marker.setVisible(showMarkers);
        });
        // Toggle booking markers + pulse overlays
        bookingMarkerPool.current.forEach(({ marker, pulseDiv }) => {
            marker.setVisible(showMarkers);
            if (pulseDiv) {
                // Hide pulse overlay when markers are hidden
                if (!showMarkers && pulseDiv.getMap()) pulseDiv.setMap(null);
                else if (showMarkers && !pulseDiv.getMap()) pulseDiv.setMap(map);
            }
        });

        // Toggle clusterer visibility
        if (driverClustererRef.current) {
            if (!showMarkers) {
                driverClustererRef.current.setMinimumClusterSize(99999); // effectively hide
            } else {
                driverClustererRef.current.setMinimumClusterSize(defaultClusterOptions.minimumClusterSize);
            }
            driverClustererRef.current.repaint();
        }
        if (bookingClustererRef.current) {
            if (!showMarkers) {
                bookingClustererRef.current.setMinimumClusterSize(99999);
            } else {
                bookingClustererRef.current.setMinimumClusterSize(defaultClusterOptions.minimumClusterSize);
            }
            bookingClustererRef.current.repaint();
        }
    }, [zoom, map]);

    // =========================
    // Tier 1: District Badge Overlays (visible at zoom < 10)
    // =========================
    useEffect(() => {
        if (!map || typeof window.google === 'undefined') return;

        // Remove existing badges
        zoneBadgePool.current.forEach(overlay => overlay.setMap(null));
        zoneBadgePool.current = [];

        if (zoom >= 10) return; // Only show at district zoom (< 10)

        const zoneStats = calculateZoneStats(drivers, bookings, districtMapping, showCompletedBookings);

        class ZoneBadgeOverlay extends window.google.maps.OverlayView {
            constructor(zoneData) {
                super();
                this.zoneData = zoneData;
                this.position = new window.google.maps.LatLng(zoneData.lat, zoneData.lng);
                this.div = null;
            }
            onAdd() {
                this.div = document.createElement('div');
                this.div.style.position = 'absolute';
                this.div.style.cursor = 'pointer';
                this.div.style.pointerEvents = 'auto';
                this.div.style.zIndex = '500';

                const d = this.zoneData;
                const fillRate = d.fillRate;
                let borderColor = '#10B981'; // Green (healthy)
                let statusEmoji = '🟢';
                if (fillRate < 60) { borderColor = '#EF4444'; statusEmoji = '🔴'; }
                else if (fillRate < 80) { borderColor = '#F59E0B'; statusEmoji = '🟡'; }

                this.div.innerHTML = `
                    <div style="
                        background: rgba(17, 24, 39, 0.92);
                        border: 2px solid ${borderColor};
                        border-radius: 10px;
                        padding: 10px 14px;
                        color: white;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: 12px;
                        min-width: 160px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                        transform: translate(-50%, -50%);
                        white-space: nowrap;
                    ">
                        <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 4px;">
                            📍 ${d.name}
                        </div>
                        <div style="margin-bottom: 3px;">🚛 <strong>${d.totalDrivers}</strong> Drivers <span style="color: #9CA3AF;">(${d.availableDrivers} avail)</span></div>
                        <div style="margin-bottom: 3px;">📦 <strong>${d.totalBookings}</strong> Bookings</div>
                        ${d.unassignedBookings > 0 ? `<div style="margin-bottom: 3px; color: #EF4444;">🔴 <strong>${d.unassignedBookings}</strong> Unassigned</div>` : ''}
                        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.15);">
                            Fill Rate: <strong>${fillRate}%</strong> ${statusEmoji}
                        </div>
                    </div>
                `;

                const panes = this.getPanes();
                panes.floatPane.appendChild(this.div);
            }
            draw() {
                if (!this.div) return;
                const projection = this.getProjection();
                if (!projection) return;
                const pos = projection.fromLatLngToDivPixel(this.position);
                if (pos) {
                    this.div.style.left = pos.x + 'px';
                    this.div.style.top = pos.y + 'px';
                }
            }
            onRemove() {
                if (this.div && this.div.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                    this.div = null;
                }
            }
        }

        zoneStats.forEach(zone => {
            if (zone.totalDrivers === 0 && zone.totalBookings === 0) return;
            const badge = new ZoneBadgeOverlay(zone);
            badge.setMap(map);
            zoneBadgePool.current.push(badge);
        });

        return () => {
            zoneBadgePool.current.forEach(overlay => overlay.setMap(null));
            zoneBadgePool.current = [];
        };
    }, [map, zoom, drivers, bookings, districtMapping, showCompletedBookings]);

    // Create clusterers once, not every poll
    useEffect(() => {
        if (!map || typeof window.google === 'undefined') return;

        driverClustererRef.current = new Clusterer(map, [], driverClusterOptions);
        bookingClustererRef.current = new Clusterer(map, [], bookingClusterOptions);

        return () => {
            // Full cleanup on unmount
            driverMarkerPool.current.forEach(({ marker, listener }) => {
                window.google.maps.event.removeListener(listener);
                marker.setMap(null);
            });
            bookingMarkerPool.current.forEach(({ marker, listener, pulseDiv }) => {
                window.google.maps.event.removeListener(listener);
                marker.setMap(null);
                if (pulseDiv) pulseDiv.setMap(null);
            });
            driverMarkerPool.current.clear();
            bookingMarkerPool.current.clear();
            if (driverClustererRef.current) {
                driverClustererRef.current.clearMarkers();
                if (window.google.maps.OverlayView?.prototype?.setMap) {
                    window.google.maps.OverlayView.prototype.setMap.call(driverClustererRef.current, null);
                }
            }
            if (bookingClustererRef.current) {
                bookingClustererRef.current.clearMarkers();
                if (window.google.maps.OverlayView?.prototype?.setMap) {
                    window.google.maps.OverlayView.prototype.setMap.call(bookingClustererRef.current, null);
                }
            }
        };
    }, [map]);

    // Note: registered drivers are placed directly on the map — not clustered.

    // Diff-based driver marker updates
    useEffect(() => {
        if (!map || !driverClustererRef.current) return;

        const currentIds = new Set();
        drivers.forEach((driver) => {
            const id = driver.driver_id || driver.id;
            if (!id) return;
            currentIds.add(id);
            const lat = parseFloat(driver.current_lat);
            const lng = parseFloat(driver.current_lng);
            if (isNaN(lat) || isNaN(lng)) return;

            let opacity = 1.0;
            let zIndex = 10;
            if (driver.driver_status === 'available') {
                zIndex = 100;
            } else if (driver.driver_status === 'active') {
                zIndex = 50;
            } else if (driver.type === 'registered' || driver.driver_status === 'registered') {
                zIndex = 20;
            } else {
                zIndex = 1;
                opacity = 0.6;
            }

            const existing = driverMarkerPool.current.get(id);
            if (existing) {
                // Smoothly animate position update
                animateMarker(id, existing.marker, { lat, lng });

                // Only update icon if status changed to prevent flickering
                if (existing.status !== driver.driver_status) {
                    existing.marker.setIcon(getDriverIcon(driver.driver_status));
                    existing.status = driver.driver_status;
                }
                
                existing.marker.setOpacity(opacity);
                existing.marker.setZIndex(zIndex);
            } else {
                // New driver — create marker
                const isRegistered = driver.type === 'registered' || driver.driver_status === 'registered';
                const marker = new window.google.maps.Marker({
                    position: { lat, lng },
                    icon: getDriverIcon(driver.driver_status),
                    title: `Driver: ${driver.driver_name} | ${driver.vehicle_id || '-'}`,
                    opacity,
                    zIndex,
                });
                const listener = marker.addListener('click', () => {
                    const pos = marker.getPosition();
                    const curLat = pos.lat();
                    const curLng = pos.lng();
                    const key = locationKey(curLat, curLng);

                    onSelectBooking?.(null);
                    setSelectedLocationBookings([]);

                    const coLocated = driversRef.current.filter(d => {
                        const dLat = parseFloat(d.current_lat);
                        const dLng = parseFloat(d.current_lng);
                        return locationKey(dLat, dLng) === key;
                    });
                    setSelectedLocationDrivers(coLocated);

                    // Find the latest driver object by ID from the ref to ensure it's not stale
                    const latestDriver = driversRef.current.find(d => (d.driver_id || d.id) === id);
                    onSelectDriver?.(latestDriver || driver);
                });
                driverMarkerPool.current.set(id, { marker, listener, status: driver.driver_status, isRegistered });
                // Registered drivers skip the clusterer — render individually
                if (isRegistered) {
                    marker.setMap(map);
                } else {
                    driverClustererRef.current.addMarker(marker);
                }
            }
        });

        // Remove drivers that are no longer in data
        driverMarkerPool.current.forEach(({ marker, listener, isRegistered }, id) => {
            if (!currentIds.has(id)) {
                if (markerAnimations.current.has(id)) {
                    cancelAnimationFrame(markerAnimations.current.get(id).requestID);
                    markerAnimations.current.delete(id);
                }
                window.google.maps.event.removeListener(listener);
                if (isRegistered) {
                    marker.setMap(null);
                } else {
                    driverClustererRef.current.removeMarker(marker);
                    marker.setMap(null);
                }
                driverMarkerPool.current.delete(id);
            }
        });

        // Repaint clusters
        driverClustererRef.current.repaint();
    }, [map, drivers, onSelectDriver, onSelectBooking]);

    // Helper: create a pulsing ring overlay at a marker's position using OverlayView
    const createPulseOverlay = useCallback((marker, color) => {
        if (!map || typeof window.google === 'undefined') return null;

        class PulseOverlay extends window.google.maps.OverlayView {
            constructor(position, pulseColor) {
                super();
                this.position = position;
                this.pulseColor = pulseColor;
                this.div = null;
            }
            onAdd() {
                this.div = document.createElement('div');
                this.div.style.position = 'absolute';
                this.div.style.pointerEvents = 'none';
                // Inner pulsing ring
                const ring = document.createElement('div');
                ring.className = 'ops-pulse-ring';
                ring.style.border = `3px solid ${this.pulseColor}`;
                this.div.appendChild(ring);
                const panes = this.getPanes();
                panes.overlayMouseTarget.appendChild(this.div);
            }
            draw() {
                if (!this.div) return;
                const overlayProjection = this.getProjection();
                if (!overlayProjection) return;
                const pos = overlayProjection.fromLatLngToDivPixel(this.position);
                if (pos) {
                    // Center the 28px ring on the pin's circle head
                    // Pin anchor is at bottom tip. Circle center is ~16px above tip at scale 1.8
                    this.div.style.left = (pos.x - 14) + 'px';
                    this.div.style.top = (pos.y - 14 - 16) + 'px';
                }
            }
            onRemove() {
                if (this.div && this.div.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                    this.div = null;
                }
            }
            updatePosition(newPosition) {
                this.position = newPosition;
                this.draw();
            }
        }

        const overlay = new PulseOverlay(marker.getPosition(), color);
        overlay.setMap(map);
        return overlay;
    }, [map]);

    // Diff-based booking marker updates
    useEffect(() => {
        if (!map || !bookingClustererRef.current) return;

        const currentIds = new Set();

        bookings.forEach((booking) => {
            const id = booking.id;
            if (!id) return;

            // Skip completed bookings — unless toggle is on OR this specific one is selected from sidebar
            if (booking.state === 'Completed' && !showCompletedBookings && (!selectedBooking || selectedBooking.id !== id)) return;

            // Derive effective status
            let effectiveStatus = booking.state;
            if (booking.is_unassigned) {
                effectiveStatus = 'Unassigned';
            } else if (booking.escalation) {
                effectiveStatus = 'Delayed';
            } else if (booking.state === 'Pending') {
                const now = new Date();
                const pickupTime = new Date(booking.pickup_time);
                if (pickupTime < now) {
                    const isToday = pickupTime.toDateString() === now.toDateString();
                    effectiveStatus = isToday ? 'Overdue' : 'Unassigned';
                }
            }

            const isUrgent = effectiveStatus === 'Unassigned' || effectiveStatus === 'Delayed' || effectiveStatus === 'Overdue';

            // Apply Critical Only filter: Skip non-critical bookings when filter is ON
            if (showCriticalOnly && !isUrgent) {
                return;
            }

            currentIds.add(id);
            const lat = parseFloat(booking.pickup_lat);
            const lng = parseFloat(booking.pickup_lng || booking.pickup_lon);
            if (isNaN(lat) || isNaN(lng)) return;

            // Temporal context: compute overdue label from backend escalation data
            let overdueBadge = '';
            if (effectiveStatus === 'Delayed' && booking.escalation) {
                const esc = booking.escalation;
                const typeLabel = esc.escalation_type === 'pickup_delay' ? 'Pickup Delay'
                    : esc.escalation_type === 'destination_delay' ? 'Drop Delay'
                        : esc.escalation_type === 'completion_delay' ? 'Completion Delay'
                            : 'Delayed';
                const mins = esc.time_overdue_minutes || 0;
                if (mins >= 60) {
                    overdueBadge = ` ${typeLabel} ⏱ ${Math.floor(mins / 60)}h ${mins % 60}m`;
                } else {
                    overdueBadge = ` ${typeLabel} ⏱ ${mins} min`;
                }
            } else if (effectiveStatus === 'Unassigned') {
                overdueBadge = ' ⚠ Unassigned';
            }
            const icon = getBookingIcon(effectiveStatus);
            // 1.5× size for urgent markers
            if (isUrgent) {
                icon.scale = 1.8; // 1.5× of normal 1.2
            }

            const markerTitle = `Booking #${booking.reference_id}${overdueBadge}`;

            // Bounce-on-entry: bounce once when a booking first becomes urgent
            const wasUrgent = prevUrgencyRef.current.get(id);
            const justBecameUrgent = isUrgent && !wasUrgent;
            prevUrgencyRef.current.set(id, isUrgent);

            const existing = bookingMarkerPool.current.get(id);
            if (existing) {
                // Update position and icon
                const pos = existing.marker.getPosition();
                if (Math.abs(pos.lat() - lat) > 0.00001 || Math.abs(pos.lng() - lng) > 0.00001) {
                    existing.marker.setPosition({ lat, lng });
                }
                existing.marker.setIcon(icon);
                existing.marker.setTitle(markerTitle);
                existing.marker.setZIndex(isUrgent ? 200 : 10);

                // Bounce once if just became urgent
                if (justBecameUrgent) {
                    existing.marker.setAnimation(window.google.maps.Animation.BOUNCE);
                    setTimeout(() => existing.marker.setAnimation(null), 1400);
                }

                // Add/remove pulse based on urgency change
                if (isUrgent && !existing.pulseDiv) {
                    const pulseColor = effectiveStatus === 'Unassigned' ? '#EF4444' : '#A855F7';
                    existing.pulseDiv = createPulseOverlay(existing.marker, pulseColor);
                } else if (!isUrgent && existing.pulseDiv) {
                    existing.pulseDiv.setMap(null);
                    existing.pulseDiv = null;
                }
            } else {
                // New booking — create marker
                const marker = new window.google.maps.Marker({
                    position: { lat, lng },
                    icon,
                    title: markerTitle,
                    zIndex: isUrgent ? 200 : 10,
                });

                // Bounce once on first appearance if already urgent
                if (isUrgent) {
                    marker.setAnimation(window.google.maps.Animation.BOUNCE);
                    setTimeout(() => marker.setAnimation(null), 1400);
                }

                const listener = marker.addListener('click', () => {
                    const pos = marker.getPosition();
                    const curLat = pos.lat();
                    const curLng = pos.lng();
                    const key = locationKey(curLat, curLng);

                    onSelectDriver?.(null);
                    
                    // Sort co-located by urgency
                    const urgencyScore = (b) => {
                        if (b.is_unassigned) return 0;
                        const st = b.state;
                        if (st === 'Delayed') return 1;
                        if (st === 'Pending') return 2;
                        if (st === 'Assigned') return 3;
                        return 4;
                    };
                    const coLocated = bookingsRef.current
                        .filter(b => {
                            const bLat = parseFloat(b.pickup_lat);
                            const bLng = parseFloat(b.pickup_lng || b.pickup_lon);
                            return locationKey(bLat, bLng) === key;
                        })
                        .sort((a, b) => urgencyScore(a) - urgencyScore(b));
                    setSelectedLocationBookings(coLocated);

                    // Find latest booking object
                    const latestBooking = bookingsRef.current.find(b => b.id === id);
                    onSelectBooking?.(latestBooking || booking);
                });

                let pulseDiv = null;
                if (isUrgent) {
                    const pulseColor = effectiveStatus === 'Unassigned' ? '#EF4444' : '#A855F7';
                    pulseDiv = createPulseOverlay(marker, pulseColor);
                }

                bookingMarkerPool.current.set(id, { marker, listener, pulseDiv });
                bookingClustererRef.current.addMarker(marker);
            }
        });

        // Remove bookings no longer in data
        bookingMarkerPool.current.forEach(({ marker, listener, pulseDiv }, id) => {
            if (!currentIds.has(id)) {
                window.google.maps.event.removeListener(listener);
                bookingClustererRef.current.removeMarker(marker);
                marker.setMap(null);
                if (pulseDiv) pulseDiv.setMap(null);
                bookingMarkerPool.current.delete(id);
            }
        });

        // Repaint clusters
        bookingClustererRef.current.repaint();
    }, [map, drivers, bookings, selectedBooking, onSelectDriver, onSelectBooking, createPulseOverlay, showCriticalOnly, showCompletedBookings]);

    // Auto-fit bounds ONLY on initial data load
    React.useEffect(() => {
        if (hasFittedBounds.current) return; // Already fitted — preserve user's viewport
        if (mapViewport) {
            // Skip auto-fit if we have a saved viewport to restore
            hasFittedBounds.current = true;
            return;
        }
        if (map && (drivers.length > 0 || bookings.length > 0)) {
            const bounds = new window.google.maps.LatLngBounds();
            let hasPoints = false;

            drivers.forEach(driver => {
                const lat = parseFloat(driver.current_lat);
                const lng = parseFloat(driver.current_lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    bounds.extend({ lat, lng });
                    hasPoints = true;
                }
            });

            bookings.forEach(booking => {
                const lat = parseFloat(booking.pickup_lat);
                const lng = parseFloat(booking.pickup_lng || booking.pickup_lon);
                if (!isNaN(lat) && !isNaN(lng)) {
                    bounds.extend({ lat, lng });
                    hasPoints = true;
                }
            });

            if (trips && trips.length > 0) {
                trips.forEach(trip => {
                    const pLat = parseFloat(trip.pickup_lat);
                    const pLng = parseFloat(trip.pickup_lng || trip.pickup_lon);
                    const dLat = parseFloat(trip.drop_lat);
                    const dLng = parseFloat(trip.drop_lng || trip.drop_lon);
                    if (!isNaN(pLat) && !isNaN(pLng)) {
                        bounds.extend({ lat: pLat, lng: pLng });
                        hasPoints = true;
                    }
                    if (!isNaN(dLat) && !isNaN(dLng)) {
                        bounds.extend({ lat: dLat, lng: dLng });
                    }
                });
            }

            if (hasPoints) {
                map.fitBounds(bounds);
                hasFittedBounds.current = true;
                // Zoom out slightly if too zoomed in (e.g., single point)
                window.google.maps.event.addListenerOnce(map, "idle", () => {
                    if (map.getZoom() > 15) map.setZoom(15);
                });
            }
        }
    }, [map, drivers, bookings, trips]);

    if (loadError) {
        return <div className="text-danger p-3">Error loading map: {loadError.message}</div>;
    }

    if (!isLoaded) {
        return <div className="d-flex justify-content-center align-items-center h-100"><i className="fa fa-spinner fa-spin fa-3x text-muted"></i></div>;
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapViewport ? mapViewport.center : defaultCenter}
                zoom={mapViewport ? mapViewport.zoom : 11}
                onLoad={onLoad}
                onIdle={() => {
                    // Do not save viewport if we haven't completed the initial fit bounds logic yet
                    if (!hasFittedBounds.current) return;

                    if (map && onViewportChange) {
                        try {
                            const newCenter = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
                            const newZoom = map.getZoom();
                            if (!mapViewport ||
                                mapViewport.zoom !== newZoom ||
                                Math.abs(mapViewport.center.lat - newCenter.lat) > 0.0001 ||
                                Math.abs(mapViewport.center.lng - newCenter.lng) > 0.0001) {
                                onViewportChange({ center: newCenter, zoom: newZoom });
                            }
                        } catch (e) {
                            console.error('Error saving map viewport', e);
                        }
                    }
                }}
                onUnmount={onUnmount}
                options={options}
                onClick={() => { onSelectBooking?.(null); setSelectedLocationBookings([]); onSelectDriver?.(null); setSelectedLocationDrivers([]); }}
            >


                {/* Serviceable Zone Overlay */}
                {
                    showServiceZone && serviceZones.length > 0 && serviceZones.map((polygonCoords, index) => (
                        <Polygon
                            key={`zone-${index}`}
                            paths={polygonCoords}
                            options={{
                                fillColor: "#3c3d3eff",
                                fillOpacity: 0.15,  // Very light opacity
                                strokeOpacity: 0,  // CRUCIAL: 0 to hide honeycomb
                                strokeWeight: 0,
                                clickable: false,
                                zIndex: 0
                            }}
                        />
                    ))
                }
                {/* Hotzones Overlay — click polygon to see details */}
                {
                    showHotzones && hotzones.length > 0 && Object.values(hotzones
                        .filter((zone) => {
                            const src = zone.source || 'unknown';
                            if (src === 'realtime' && !showRealtimeHotzones) return false;
                            if ((src === 'historical' || src === 'unknown') && !showHistoricalHotzones) return false;
                            return true;
                        })
                        .reduce((acc, zone) => {
                            // Group by hotzone_id to handle overlapping classes
                            if (!acc[zone.hotzone_id]) {
                                acc[zone.hotzone_id] = {
                                    hotzone_id: zone.hotzone_id,
                                    polygon: zone.polygon,
                                    center: zone.center,
                                    isRealtime: false,
                                    zones: []
                                };
                            }
                            if (zone.source === 'realtime') acc[zone.hotzone_id].isRealtime = true;
                            acc[zone.hotzone_id].zones.push(zone);
                            return acc;
                        }, {}))
                        .map((group, index) => {
                            const isRealtime = group.isRealtime;
                            const fillColor = isRealtime ? '#EF4444' : '#F59E0B';
                            const strokeColor = isRealtime ? '#EF4444' : '#F59E0B';
                            return (
                                <Polygon
                                    key={`hotzone-group-${group.hotzone_id || index}`}
                                    paths={group.polygon}
                                    options={{
                                        fillColor: fillColor,
                                        fillOpacity: isRealtime ? 0.25 : 0.15,
                                        strokeColor: strokeColor,
                                        strokeOpacity: 0.6,
                                        strokeWeight: 1.5,
                                        clickable: true,
                                        zIndex: isRealtime ? 2 : 1
                                    }}
                                    onClick={() => setSelectedHotzone(group)}
                                />
                            );
                        })
                }
                {/* Hotzone InfoWindow — appears when a polygon is clicked */}
                {selectedHotzone && selectedHotzone.center && (
                    <InfoWindow
                        position={{ lat: selectedHotzone.center.lat, lng: selectedHotzone.center.lng }}
                        onCloseClick={() => setSelectedHotzone(null)}
                    >
                        <div className="ops-map-infowindow" style={{ minWidth: '180px', padding: '4px', color: '#1f2937', background: '#fff' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: selectedHotzone.isRealtime ? '#DC2626' : '#D97706' }}>
                                {selectedHotzone.isRealtime ? '🔴 Hotzone (Today\'s Demand)' : '🟡 Vehicle Recommendation'}
                            </div>
                            {selectedHotzone.zones.map((zone, idx) => (
                                <div key={idx} style={{ marginBottom: '8px', borderBottom: idx < selectedHotzone.zones.length - 1 ? '1px solid #e5e7eb' : 'none', paddingBottom: idx < selectedHotzone.zones.length - 1 ? '8px' : '0' }}>
                                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                        <strong>Vehicle Class:</strong> {zone.vehicle_class_name || `Class ${zone.vehicle_class_id}`}
                                    </div>
                                    <div style={{ fontSize: '12px', marginBottom: '2px' }}>
                                        <strong>Demand:</strong> {zone.demand} &nbsp;|&nbsp; <strong>Supply:</strong> {zone.supply}
                                    </div>
                                    <div style={{ fontSize: '12px', marginBottom: '2px' }}>
                                        <strong>Drivers Needed:</strong> {zone.gap}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </InfoWindow>
                )}
                {/* Drop-point marker when a booking is selected */}
                {
                    selectedBooking && (() => {
                        const dropLat = parseFloat(selectedBooking.drop_lat);
                        const dropLng = parseFloat(selectedBooking.drop_lng || selectedBooking.drop_lon);
                        if (isNaN(dropLat) || isNaN(dropLng)) return null;
                        return (
                            <Marker
                                position={{ lat: dropLat, lng: dropLng }}
                                icon={getDropIcon()}
                                title="Drop point"
                            />
                        );
                    })()
                }

                {/* Active Trip Routes */}
                {trips && trips.length > 0 && trips.map((trip) => {
                    const pLat = parseFloat(trip.pickup_lat);
                    const pLng = parseFloat(trip.pickup_lng || trip.pickup_lon);
                    const dLat = parseFloat(trip.drop_lat);
                    const dLng = parseFloat(trip.drop_lng || trip.drop_lon);
                    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) return null;
                    const path = [{ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng }];
                    return (
                        <Polyline
                            key={`trip-route-${trip.id || trip.trip_id}`}
                            path={path}
                            options={{
                                strokeColor: trip.state === 'Delayed' ? '#EF4444' : '#3B82F6', // Red for delayed, blue for ongoing
                                strokeOpacity: 0.8,
                                strokeWeight: 3,
                                strokePattern: [10, 5],
                                geodesic: true,
                            }}
                        />
                    );
                })}

                {/* Driver Info Window — scrollable when multiple drivers share the same location */}
                {
                    selectedDriver && selectedLocationDrivers.length > 0 && (
                        <InfoWindow
                            position={{ lat: parseFloat(selectedDriver.current_lat), lng: parseFloat(selectedDriver.current_lng) }}
                            onCloseClick={() => { onSelectDriver?.(null); setSelectedLocationDrivers([]); }}
                        >
                            <div className="ops-map-infowindow" style={{ minWidth: '280px', maxHeight: '320px', overflowY: 'auto', padding: '4px 2px', color: '#1f2937', background: '#fff' }}>
                                {selectedLocationDrivers.length > 1 && (
                                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', borderBottom: '2px solid #10B981', paddingBottom: '4px', color: '#1e3a5f' }}>
                                        🚛 {selectedLocationDrivers.length} Vehicles at this location
                                    </div>
                                )}
                                {selectedLocationDrivers.map((drv, idx) => {
                                    const isActive = selectedDriver && (selectedDriver.driver_id || selectedDriver.id) === (drv.driver_id || drv.id);
                                    return (
                                        <div
                                            key={drv.driver_id || drv.id || idx}
                                            style={{
                                                padding: '8px',
                                                borderBottom: idx < selectedLocationDrivers.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                backgroundColor: isActive ? '#ECFDF5' : (idx % 2 === 0 ? '#fff' : '#f9fafb'),
                                                borderLeft: isActive ? '3px solid #10B981' : '3px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                            }}
                                            onClick={() => onSelectDriver?.(drv)}
                                        >
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <h6 style={{ fontWeight: 700, marginBottom: '0', fontSize: '14px', color: '#1f2937', paddingRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {drv.driver_name}
                                                    {drv.vehicle_id && <span className="ml-1" style={{ fontWeight: 800 }}>({drv.vehicle_id})</span>}
                                                </h6>
                                                {drv.driver_status === 'registered' && drv.current_step && drv.current_step !== '-' && (
                                                    <span style={{
                                                        background: drv.current_step === 'completion' ? '#dcfce7' : '#fef08a',
                                                        color: drv.current_step === 'completion' ? '#166534' : '#854d0e',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        textTransform: 'capitalize',
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0
                                                    }}>
                                                        {drv.current_step}
                                                    </span>
                                                )}
                                            </div>
                                            {drv.driver_status !== 'registered' && (
                                                <p style={{ marginBottom: '4px', color: '#6b7280', fontSize: '10px' }}>{drv.vehicle_registration}</p>
                                            )}
                                            <div style={{ marginBottom: '4px' }}>
                                                <span className={`badge badge-${drv.driver_status === 'active' ? 'primary' :
                                                    drv.driver_status === 'available' ? 'success' :
                                                        'secondary'
                                                    }`} style={{ fontSize: '11px' }}>
                                                    {drv.driver_status === 'active'
                                                        ? (drv.current_trip_status || 'active').replace(/_/g, ' ')
                                                        : (drv.driver_status || 'Unknown')}
                                                </span>
                                                <span className="badge badge-info ml-1" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                                                    {String(drv.vehicle_class).replace('class', 'Class ')}
                                                    {drv.vehicle_model && drv.vehicle_model !== 'N/A' ? ` - ${drv.vehicle_model}` : ''}
                                                </span>
                                            </div>
                                            <p style={{ marginBottom: '0', fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                <i className="fa fa-phone mr-1" style={{ width: '12px', textAlign: 'center' }}></i> {drv.phone}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </InfoWindow>
                    )
                }

                {/* Booking Info Window — scrollable when multiple bookings share the same location */}
                {
                    selectedBooking && selectedLocationBookings.length > 0 && (
                        <InfoWindow
                            position={{ lat: parseFloat(selectedBooking.pickup_lat), lng: parseFloat(selectedBooking.pickup_lng || selectedBooking.pickup_lon) }}
                            onCloseClick={() => { onSelectBooking?.(null); setSelectedLocationBookings([]); }}
                        >
                            <div className="ops-map-infowindow" style={{ minWidth: '240px', maxHeight: '320px', overflowY: 'auto', padding: '4px 2px', color: '#1f2937', background: '#fff' }}>
                                {selectedLocationBookings.length > 1 && (
                                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', borderBottom: '2px solid #3B82F6', paddingBottom: '4px', color: '#1e3a5f' }}>
                                        📦 {selectedLocationBookings.length} Bookings at this location
                                    </div>
                                )}
                                {selectedLocationBookings.map((bk, idx) => {
                                    const now = new Date();
                                    const pickupTime = new Date(bk.pickup_time);
                                    const isPastPickup = bk.state === 'Pending' && pickupTime < now;
                                    const isToday = pickupTime.toDateString() === now.toDateString();
                                    const isOverdue = isPastPickup && isToday;
                                    const isHistoricalUnassigned = isPastPickup && !isToday;
                                    const displayState = isOverdue ? 'Overdue' : isHistoricalUnassigned ? 'Unassigned' : bk.state;

                                    const statusColor = bk.is_unassigned || isHistoricalUnassigned
                                        ? '#EF4444'
                                        : bk.escalation || isOverdue
                                            ? '#A855F7'
                                            : displayState === 'Completed'
                                                ? '#10B981'
                                                : displayState === 'Pending'
                                                    ? '#FFFFFF'
                                                    : '#3B82F6';
                                    const statusLabel = bk.is_unassigned
                                        ? 'Unassigned'
                                        : bk.escalation
                                            ? (bk.escalation.escalation_type === 'pickup_delay' ? 'Pickup Delay'
                                                : bk.escalation.escalation_type === 'destination_delay' ? 'Drop Delay'
                                                    : bk.escalation.escalation_type === 'completion_delay' ? 'Completion Delay'
                                                        : 'Delayed')
                                            : (displayState || 'Unknown');
                                    const isLightBg = !bk.is_unassigned && !bk.escalation && displayState === 'Pending';
                                    const isActive = selectedBooking && (selectedBooking.id === bk.id);
                                    return (
                                        <div
                                            key={bk.id || idx}
                                            style={{
                                                padding: '8px',
                                                borderBottom: idx < selectedLocationBookings.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                backgroundColor: isActive ? '#EBF5FF' : (idx % 2 === 0 ? '#fff' : '#f9fafb'),
                                                borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                            }}
                                            onClick={() => onSelectBooking?.(bk)}
                                            title="Click to show drop point"
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <h6 style={{ fontWeight: 700, marginBottom: '0', fontSize: '13px', color: '#1f2937' }}>Booking #{bk.id}</h6>
                                                {bk.escalation && bk.escalation.severity && (
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: bk.escalation.severity === 'high' ? '#FEE2E2' : '#FEF3C7',
                                                            color: bk.escalation.severity === 'high' ? '#B91C1C' : '#92400E',
                                                            border: `1px solid ${bk.escalation.severity === 'high' ? '#FECACA' : '#FDE68A'}`,
                                                        }}
                                                    >
                                                        {bk.escalation.severity === 'high' ? '🔴 HIGH' : '🟡 MEDIUM'}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ marginBottom: '4px' }}>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: statusColor,
                                                        color: isLightBg ? '#000' : '#fff',
                                                        border: isLightBg ? '1px solid #ccc' : 'none',
                                                        fontSize: '11px',
                                                    }}
                                                >
                                                    {statusLabel}
                                                </span>
                                                <span className="badge badge-light border ml-1" style={{ fontSize: '11px' }}>{bk.vehicle_type}</span>
                                                {(() => {
                                                    if (bk.escalation) {
                                                        const mins = bk.escalation.time_overdue_minutes || 0;
                                                        if (mins > 0) {
                                                            const lateText = mins >= 60
                                                                ? `${Math.floor(mins / 60)}h ${mins % 60}m late`
                                                                : `${mins} min late`;
                                                            return (
                                                                <span
                                                                    className="badge ml-1"
                                                                    style={{
                                                                        backgroundColor: '#FEF2F2',
                                                                        color: '#B91C1C',
                                                                        border: '1px solid #FEE2E2',
                                                                        fontSize: '11px'
                                                                    }}
                                                                >
                                                                    ⏱ {lateText}
                                                                </span>
                                                            );
                                                        }
                                                    } else if (bk.is_unassigned && bk.pickup_time) {
                                                        const pickupTime = new Date(bk.pickup_time);
                                                        const now = new Date();
                                                        const diffMins = Math.floor((now - pickupTime) / 60000);
                                                        if (diffMins > 0) {
                                                            const lateText = diffMins >= 60
                                                                ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m late`
                                                                : `${diffMins} min late`;
                                                            return (
                                                                <span
                                                                    className="badge ml-1"
                                                                    style={{
                                                                        backgroundColor: '#FEF2F2',
                                                                        color: '#B91C1C',
                                                                        border: '1px solid #FEE2E2',
                                                                        fontSize: '11px'
                                                                    }}
                                                                >
                                                                    ⏱ {lateText}
                                                                </span>
                                                            );
                                                        }
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            <div style={{ marginBottom: '4px', color: '#4b5563', fontSize: '11px' }}>
                                                <i className="fa fa-clock-o mr-1"></i>
                                                {new Date(bk.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(bk.pickup_time).toLocaleDateString()}
                                            </div>
                                            <p style={{ marginBottom: '2px', fontSize: '11px', color: '#374151' }}><strong>Pickup:</strong> {bk.pickup_address}</p>
                                            <p style={{ marginBottom: '0', fontSize: '11px', color: '#374151' }}><strong>Drop:</strong> {bk.drop_address}</p>
                                            {bk.assigned_driver_name && displayState === 'Assigned' && (
                                                <div style={{ marginTop: '6px', padding: '6px', backgroundColor: '#F3F4F6', borderRadius: '4px', borderLeft: '2px solid #6B7280' }}>
                                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#1f2937' }}>
                                                        🚛 {bk.assigned_driver_name}{bk.assigned_vehicle_id ? ` (${bk.assigned_vehicle_id})` : ''}
                                                    </p>
                                                    {(bk.assigned_vehicle_class || bk.assigned_vehicle_make || bk.assigned_vehicle_model) && (
                                                        <p style={{ margin: 0, fontSize: '10px', color: '#6B7280' }}>
                                                            {[
                                                                bk.assigned_vehicle_class ? `Class ${bk.assigned_vehicle_class}` : null,
                                                                [bk.assigned_vehicle_make, bk.assigned_vehicle_model].filter(Boolean).join(' ') || null
                                                            ].filter(Boolean).join(' - ')}
                                                        </p>
                                                    )}
                                                    <p style={{ margin: 0, fontSize: '10px', color: '#4B5563' }}>📞 {bk.assigned_driver_phone}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </InfoWindow>
                    )
                }
            </GoogleMap >
        </div>
    );
};

export default React.memo(OpsMapView);
