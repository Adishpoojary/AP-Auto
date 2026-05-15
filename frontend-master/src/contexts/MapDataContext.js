import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import { useDateFilter } from './DateFilterContext';
import opsWebSocket from '../services/opsWebSocket';

const MapDataContext = createContext(null);

const dispatchApi = axios.create({
  baseURL: config.dispatchApiBase || 'http://localhost:8001/api',
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
});

const POLL_INTERVAL_MS = 30000;

export const MapDataProvider = ({ children }) => {
  const location = useLocation();
  const { dateRange } = useDateFilter();
  const isMapRoute = location.pathname === '/app/operations-dashboard' || location.pathname === '/app/ops/map';

  const [drivers, setDrivers] = useState([]);
  const [registeredDrivers, setRegisteredDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [districtMapping, setDistrictMapping] = useState({});
  const [escalationMap, setEscalationMap] = useState({});
  const [unassignedBookingIds, setUnassignedBookingIds] = useState(new Set());
  const [hasReceivedWsData, setHasReceivedWsData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [fetchError, setFetchError] = useState(false);

  const [selectedTimeWindow, setSelectedTimeWindow] = useState({ preset: 'today' });
  const [isLive, setIsLive] = useState(true);
  const abortControllerRef = useRef(null);
  const intervalRef = useRef(null);
  const driversEtagRef = useRef(null);
  const bookingsEtagRef = useRef(null);

  const fetchDrivers = useCallback(async (signal) => {
    try {
      const params = dateRange?.startDate ? { date: dateRange.startDate } : {};
      const headers = driversEtagRef.current ? { 'If-None-Match': driversEtagRef.current } : {};
      const response = await dispatchApi.get('/ops/drivers-live-locations', { params, signal, headers });
      if (response.status === 304) return true;
      if (response.data?.success) {
        setDrivers(response.data.data);
        if (response.headers?.etag) driversEtagRef.current = response.headers.etag;
      }
      return true;
    } catch (error) {
      if (!axios.isCancel(error)) console.error('Error fetching map drivers:', error);
      return false;
    }
  }, [dateRange?.startDate]);

  const fetchBookings = useCallback(async (signal) => {
    try {
      const params = { limit: 2000 };
      if (dateRange?.startDate) {
        params.date = dateRange.startDate;
        params.start_date = dateRange.startDate;
      }
      if (dateRange?.endDate) {
        params.end_date = dateRange.endDate;
      }

      if (selectedTimeWindow.preset === 'custom' || ['morning', 'afternoon', 'evening'].includes(selectedTimeWindow.preset)) {
        if (selectedTimeWindow.startTime && selectedTimeWindow.endTime) {
          params.start_time = selectedTimeWindow.startTime;
          params.end_time = selectedTimeWindow.endTime;
        }
      } else if (selectedTimeWindow.preset) {
        params.time_window = selectedTimeWindow.preset;
      }

      const headers = bookingsEtagRef.current ? { 'If-None-Match': bookingsEtagRef.current } : {};
      const response = await dispatchApi.get('/bookings', { params, signal, headers });
      if (response.status === 304) return true;
      if (response.data?.success) {
        setBookings(response.data.data);
        if (response.headers?.etag) bookingsEtagRef.current = response.headers.etag;
      }
      return true;
    } catch (error) {
      if (!axios.isCancel(error)) console.error('Error fetching map bookings:', error);
      return false;
    }
  }, [dateRange?.startDate, dateRange?.endDate, selectedTimeWindow]);

  const fetchEscalations = useCallback(async (signal) => {
    try {
      const params = { escalation_type: 'all' };
      if (dateRange?.startDate) {
        params.date = dateRange.startDate;
        params.start_date = dateRange.startDate;
      }
      if (dateRange?.endDate) {
        params.end_date = dateRange.endDate;
      }

      const [legacyRes, pickupRes, dropRes, enrouteRes] = await Promise.all([
        dispatchApi.get('/trip-escalations', { params, signal }).catch(() => ({ data: {} })),
        dispatchApi.get('/pickup-delay-alerts', { signal }).catch(() => ({ data: {} })),
        dispatchApi.get('/drop-delay-alerts', { signal }).catch(() => ({ data: {} })),
        dispatchApi.get('/enroute-movement-alerts', { signal }).catch(() => ({ data: {} })),
      ]);

      const nextMap = {};
      const mergeAlerts = (alertsArray) => {
        if (!Array.isArray(alertsArray)) return;
        alertsArray.forEach((esc) => {
          if (esc.booking_id) nextMap[String(esc.booking_id)] = esc;
        });
      };

      if (legacyRes.data?.success) mergeAlerts(legacyRes.data.escalations);
      if (pickupRes.data?.success) {
        mergeAlerts(pickupRes.data.alerts.map((a) => ({
          ...a,
          escalation_type: 'pickup_delay',
          severity: a.severity || 'medium',
          time_overdue_minutes: a.time_overdue_minutes || a.elapsed_minutes || 0,
        })));
      }
      if (dropRes.data?.success) {
        mergeAlerts(dropRes.data.alerts.map((a) => ({
          ...a,
          escalation_type: 'destination_delay',
          severity: a.severity || 'medium',
          time_overdue_minutes: a.elapsed_minutes || a.time_overdue_minutes || 0,
        })));
      }
      if (enrouteRes.data?.success) {
        mergeAlerts(enrouteRes.data.alerts.map((a) => ({
          ...a,
          escalation_type: 'pickup_delay',
          severity: a.severity || 'medium',
          time_overdue_minutes: a.elapsed_minutes || a.time_overdue_minutes || 0,
        })));
      }

      setEscalationMap(nextMap);
      return true;
    } catch (error) {
      if (!axios.isCancel(error)) console.error('Error fetching map escalations:', error);
      return false;
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    driversEtagRef.current = null;
    bookingsEtagRef.current = null;
  }, [dateRange?.startDate, dateRange?.endDate, selectedTimeWindow]);

  useEffect(() => {
    if (!isMapRoute) return;
    dispatchApi.get('/ops/district-mapping')
      .then((res) => { if (res.data?.success) setDistrictMapping(res.data.mapping); })
      .catch((err) => console.error('Error fetching district mapping:', err));
  }, [isMapRoute]);

  useEffect(() => {
    if (!isMapRoute) return;
    let mounted = true;
    const fetchRegisteredDrivers = async () => {
      try {
        const response = await axios.get(`${config.opsApiBase || config.dispatchApiBase || 'http://localhost:8001/api'}/driver-registration/list?status=registered`);
        if (mounted && response.data?.success && Array.isArray(response.data.records)) {
          const registered = response.data.records.map(row => ({
            driver_id: row.id,
            id: row.id,
            driver_name: row.name || 'Unknown',
            vehicle_registration: row.vehicle_name || 'N/A',
            vehicle_model: row.vehicle_name,
            vehicle_class: `class${row.vehicle_class || '?'}`,
            current_lat: row.base_lat,
            current_lng: row.base_lng,
            driver_status: 'registered',
            phone: row.phone_number,
            current_step: row.current_step || '-'
          })).filter(d => d.current_lat != null && d.current_lng != null);
          setRegisteredDrivers(registered);
        }
      } catch (error) {
        console.error('Error fetching registered drivers for map:', error);
      }
    };
    fetchRegisteredDrivers();
    return () => { mounted = false; };
  }, [isMapRoute]);

  useEffect(() => {
    if (!isMapRoute) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      return;
    }

    const loadData = async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);
      const results = await Promise.all([
        fetchDrivers(controller.signal),
        fetchBookings(controller.signal),
        fetchEscalations(controller.signal),
      ]);
      setLoading(false);
      setLastUpdated(new Date());
      setFetchError(!results[0] || !results[1]);
    };

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        if (document.visibilityState === 'hidden' || !isLive) return;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const results = await Promise.all([
          fetchDrivers(controller.signal),
          fetchBookings(controller.signal),
          fetchEscalations(controller.signal),
        ]);
        setLastUpdated(new Date());
        setFetchError(!results[0] || !results[1]);
      }, POLL_INTERVAL_MS);
    };

    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (intervalRef.current) clearInterval(intervalRef.current);
      await loadData();
      startPolling();
    };

    loadData();
    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isMapRoute, fetchDrivers, fetchBookings, fetchEscalations, isLive]);

  useEffect(() => {
    if (!isMapRoute) return;
    const onEscalation = (data) => {
      if (Array.isArray(data.unassigned)) {
        setUnassignedBookingIds(new Set(data.unassigned.map((b) => String(b.booking_id))));
        setHasReceivedWsData(true);
      }
    };
    const onClear = () => {
      setUnassignedBookingIds(new Set());
      setHasReceivedWsData(true);
    };
    const onDriverLoc = (data) => {
      if (!data?.driver?.id) return;
      setDrivers((prev) => {
        const index = prev.findIndex((d) => (d.driver_id || d.id) === data.driver.id);
        if (index < 0) return prev;
        const next = [...prev];
        next[index] = { ...next[index], current_lat: data.driver.lat, current_lng: data.driver.lng };
        return next;
      });
    };

    const u1 = opsWebSocket.subscribe('escalation', onEscalation);
    const u2 = opsWebSocket.subscribe('clear_all', onClear);
    const u3 = opsWebSocket.subscribe('driver_location_update', onDriverLoc);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [isMapRoute]);

  const enrichedBookings = useMemo(() => {
    return bookings.map((b) => {
      const bid = String(b.id || b.booking_id);
      return {
        ...b,
        is_unassigned: hasReceivedWsData ? unassignedBookingIds.has(bid) : b.is_unassigned,
        escalation: escalationMap[bid] || null,
      };
    });
  }, [bookings, hasReceivedWsData, unassignedBookingIds, escalationMap]);

  const value = useMemo(() => ({
    drivers,
    registeredDrivers,
    bookings: enrichedBookings,
    escalationMap,
    districtMapping,
    selectedTimeWindow,
    setSelectedTimeWindow,
    isLive,
    setIsLive,
    loading,
    lastUpdated,
    fetchError,
  }), [
    drivers,
    registeredDrivers,
    enrichedBookings,
    escalationMap,
    districtMapping,
    selectedTimeWindow,
    isLive,
    loading,
    lastUpdated,
    fetchError,
  ]);

  return <MapDataContext.Provider value={value}>{children}</MapDataContext.Provider>;
};

export const useMapData = () => {
  const ctx = useContext(MapDataContext);
  if (!ctx) {
    throw new Error('useMapData must be used within MapDataProvider');
  }
  return ctx;
};
