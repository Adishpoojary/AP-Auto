import React, { useState, useEffect, useCallback } from 'react';
import { Table, Badge } from 'reactstrap';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import SkeletonCard from './SkeletonCard';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { getDriverDisplay } from '../../utils/driverUtils';

const POLL_INTERVAL_MS = 30000;

const escalationApi = axios.create({
  baseURL: config.dispatchApiUrl,
});

escalationApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const DelayedTripsPanel = ({ onClose }) => {
    const { dateRange } = useDateFilter();
    const history = useHistory();
    const [escalations, setEscalations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEscalations = useCallback(async () => {
        try {
            const filterDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
            
            // Try primary endpoint, fallback to localhost if it fails (matching TripEscalations logic)
            let res;
            try {
                res = await escalationApi.get(`/trip-escalations?escalation_type=all&date=${filterDate}`);
            } catch (primaryError) {
                res = await axios.get(`${config.dispatchApiUrl}/trip-escalations?escalation_type=all&date=${filterDate}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            }
            
            setEscalations(res.data?.escalations || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching delayed trips:', err);
            setError('Could not load delayed trips');
        } finally {
            setLoading(false);
        }
    }, [dateRange?.endDate]);

    const todayStr = new Date().toISOString().split('T')[0];
    const isTodaySelected =
        (!dateRange?.startDate && !dateRange?.endDate) ||
        (dateRange?.endDate === todayStr && (!dateRange?.startDate || dateRange?.startDate === todayStr));

    useEffect(() => {
        fetchEscalations();
        if (!isTodaySelected) return;
        const interval = setInterval(fetchEscalations, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchEscalations, isTodaySelected]);

    const formatOverdue = (minutes) => {
        if (!minutes || minutes <= 0) return '-';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const getTypeBadge = (type) => {
        if (type === 'pickup_delay') return <Badge color="warning">Pickup Delay</Badge>;
        if (type === 'destination_delay') return <Badge color="danger">Drop Delay</Badge>;
        if (type === 'completion_delay') return <Badge color="info">Completion Delay</Badge>;
        return <Badge color="secondary">{type}</Badge>;
    };

    const handleRowClick = () => {
        if (onClose) onClose();
        history.push('/app/trips/escalations');
    };

    if (loading && escalations.length === 0) {
        return <SkeletonCard height="240px" />;
    }

    if (error) {
        return <div className="text-muted p-3 text-center">{error}</div>;
    }

    return (
        <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
            <Table borderless hover size="sm" className="mb-0">
                <thead className="sticky-top bg-light">
                    <tr>
                        <th className="text-muted border-bottom-0">Trip / Booking</th>
                        <th className="text-muted border-bottom-0">Driver</th>
                        <th className="text-muted border-bottom-0">Delay Type</th>
                        <th className="text-muted border-bottom-0">Overdue</th>
                    </tr>
                </thead>
                <tbody>
                    {escalations.length > 0 ? escalations.map(esc => (
                        <tr 
                            key={esc.trip_id || esc.id || Math.random()} 
                            onClick={handleRowClick}
                            style={{ cursor: 'pointer' }}
                        >
                            <td>
                                <div><strong className="text-primary">{esc.booking_id}</strong></div>
                                <div className="small text-muted">Trip #{esc.trip_id || esc.id}</div>
                            </td>
                            <td>
                                <div><span className="font-weight-bold">{getDriverDisplay(esc)}</span></div>
                                <div className="small text-muted">{esc.vehicle_registration || '—'}</div>
                            </td>
                            <td>
                                {getTypeBadge(esc.escalation_type)}
                                {esc.severity === 'high' && <Badge color="danger" className="ml-1">High</Badge>}
                            </td>
                            <td className={esc.severity === 'high' ? 'text-danger font-weight-bold' : ''}>
                                {formatOverdue(esc.time_overdue_minutes)}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="text-center text-muted py-4">
                                No delayed trips found
                            </td>
                        </tr>
                    )}
                </tbody>
            </Table>
        </div>
    );
};

export default DelayedTripsPanel;
