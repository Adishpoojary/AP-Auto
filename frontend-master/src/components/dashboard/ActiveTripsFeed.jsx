import React, { useState, useEffect, useCallback } from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';
import axios from 'axios';
import config from '../../config';
import SkeletonCard from './SkeletonCard';
import { useDateFilter } from '../../contexts/DateFilterContext';
import opsWebSocket from '../../services/opsWebSocket';
import { getDriverDisplay } from '../../utils/driverUtils';

const POLL_INTERVAL_MS = 30000;

const ActiveTripsFeed = () => {
    const { dateRange } = useDateFilter();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTripId, setSelectedTripId] = useState(null);

    const handleRowClick = (trip) => {
        setSelectedTripId(trip.id || trip.trip_id);
        if (window.handleDriverFocus) {
            window.handleDriverFocus(trip);
        }
    };

    const fetchTrips = useCallback(async () => {
        try {
            const baseUrl = (config.dispatchApiUrl || config.dispatchApiBase || 'http://localhost:8001/api').replace(/\/$/, '');
            const params = { status: 'active,ongoing,delayed' };
            if (dateRange?.startDate) params.start_date = dateRange.startDate;
            if (dateRange?.endDate) params.end_date = dateRange.endDate;
            const response = await axios.get(`${baseUrl}/v1/ops/trips`, { params });
            if (response.data && response.data.data) {
                setTrips(Array.isArray(response.data.data) ? response.data.data : []);
            }
        } catch (error) {
            console.error('Error fetching active trips:', error);
        } finally {
            setLoading(false);
        }
    }, [dateRange?.startDate, dateRange?.endDate]);

    const todayStr = new Date().toISOString().split('T')[0];
    const isTodaySelected =
        (!dateRange?.startDate && !dateRange?.endDate) ||
        (dateRange?.endDate === todayStr && (!dateRange?.startDate || dateRange?.startDate === todayStr));

    useEffect(() => {
        fetchTrips();
        if (!isTodaySelected) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchTrips();
            }
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchTrips, isTodaySelected]);

    useEffect(() => {
        const unsub = opsWebSocket.subscribe('trip_status_update', () => {
            if (document.visibilityState === 'visible') {
                fetchTrips();
            }
        });
        return unsub;
    }, [fetchTrips]);

    if (loading && trips.length === 0) {
        return <SkeletonCard height="300px" />;
    }

    return (
        <Widget title={<h5>Live Active Trips</h5>} className="mb-0 h-100 shadow-sm border-0 active-trips-panel">
            <div className="table-responsive active-trips-table-container">
                <Table borderless hover size="sm" className="mb-0">
                    <thead className="sticky-top bg-white">
                        <tr>
                            <th className="text-muted border-bottom-0">Trip ID</th>
                            <th className="text-muted border-bottom-0">Driver</th>
                            <th className="text-muted border-bottom-0">Route</th>
                            <th className="text-muted border-bottom-0">ETA</th>
                            <th className="text-muted border-bottom-0">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.length > 0 ? trips.map(trip => (
                            <tr 
                                key={trip.id || trip.trip_id}
                                onClick={() => handleRowClick(trip)}
                                style={{ 
                                    cursor: 'pointer', 
                                    backgroundColor: selectedTripId === (trip.id || trip.trip_id) ? '#F3F4F6' : 'transparent',
                                    transition: 'background-color 0.2s ease-in-out'
                                }}
                            >
                                <td className="font-weight-bold">#{trip.id || trip.trip_id}</td>
                                <td>{getDriverDisplay(trip)}</td>
                                <td>
                                    <div className="small text-truncate" style={{ maxWidth: '150px' }} title={trip.pickup_location}>
                                        <i className="fa fa-circle text-success mr-1" style={{ fontSize: '8px' }}></i>
                                        {trip.pickup_location || 'Pickup'}
                                    </div>
                                    <div className="small text-truncate" style={{ maxWidth: '150px' }} title={trip.drop_location}>
                                        <i className="fa fa-map-marker text-danger mr-1" style={{ fontSize: '10px' }}></i>
                                        {trip.drop_location || 'Drop'}
                                    </div>
                                </td>
                                <td>
                                    {trip.eta_minutes ? (
                                        <span className="text-muted">{trip.eta_minutes} mins</span>
                                    ) : (
                                        <span className="text-muted">-</span>
                                    )}
                                </td>
                                <td>
                                    <Badge color={trip.state === 'Delayed' ? 'danger' : 'primary'}>
                                        {trip.state || 'Ongoing'}
                                    </Badge>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="text-center text-muted py-3">No active trips at the moment</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </Widget>
    );
};

export default ActiveTripsFeed;
