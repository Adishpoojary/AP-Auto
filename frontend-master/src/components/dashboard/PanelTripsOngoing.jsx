import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Badge } from 'reactstrap';
import config from '../../config';
import SkeletonCard from './SkeletonCard';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getVehicleDisplay } from '../../utils/vehicleUtils';

/**
 * Trips KPI drawer — same ongoing list as KPI; table layout matches Live Active Trips feed.
 */
const PanelTripsOngoing = () => {
  const { dateRange } = useDateFilter();
  const [data, setData] = useState(null);
  const [opsById, setOpsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
      const q = params.toString() ? `?${params.toString()}` : '';
      const base = (config.dispatchApiUrl || '').replace(/\/$/, '');
      const res = await axios.get(`${base}/dashboard/panel-trips${q}`);
      setData(res.data);
    } catch (e) {
      console.error('panel-trips:', e);
      setError('Could not load trips (ensure /api/dashboard/panel-trips is deployed).');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const fetchOpsEta = async () => {
      try {
        const baseUrl = (config.dispatchApiUrl || config.dispatchApiBase || 'http://localhost:8001/api').replace(/\/$/, '');
        const params = { status: 'active,ongoing,delayed' };
        if (dateRange?.startDate) params.start_date = dateRange.startDate;
        if (dateRange?.endDate) params.end_date = dateRange.endDate;
        const res = await axios.get(`${baseUrl}/v1/ops/trips`, { params });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const m = {};
        list.forEach((t) => {
          const id = t.id ?? t.trip_id;
          if (id != null) m[id] = t;
        });
        setOpsById(m);
      } catch {
        setOpsById({});
      }
    };
    fetchOpsEta();
  }, [data?.trips, dateRange?.startDate, dateRange?.endDate]);

  if (loading && !data) {
    return <SkeletonCard height="280px" />;
  }

  if (error) {
    return <div className="text-muted p-3 small">{error}</div>;
  }

  const trips = data?.trips || [];
  const total = data?.total ?? 0;

  return (
    <div className="d-flex flex-column active-trips-embedded ongoing-panel-trips" style={{ minHeight: 0, flex: 1 }}>
      <div className="small text-muted mb-2">
        Total ongoing (KPI): <strong>{total}</strong>
        {total > trips.length ? ` — showing ${trips.length} latest` : null}
      </div>
      <div className="table-responsive active-trips-table-container active-trips-table-container-embedded">
        <Table borderless hover size="sm" className="mb-0 ongoing-panel-live-table">
          <thead className="sticky-top ongoing-panel-thead">
            <tr>
              <th className="text-muted border-bottom-0">Trip ID</th>
              <th className="text-muted border-bottom-0">Driver</th>
              <th className="text-muted border-bottom-0">Vehicle</th>
              <th className="text-muted border-bottom-0">Route</th>
              <th className="text-muted border-bottom-0">ETA</th>
              <th className="text-muted border-bottom-0">Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.length > 0 ? (
              trips.map((t) => {
                const ops = opsById[t.id];
                const eta = ops?.eta_minutes;
                const state = ops?.state;
                const delayed = state === 'Delayed';
                return (
                  <tr key={t.id}>
                    <td className="font-weight-bold">#{t.id}</td>
                    <td>{getDriverDisplay(t)}</td>
                    <td>{getVehicleDisplay(t)}</td>
                    <td>
                      <div className="small text-truncate" style={{ maxWidth: 150 }} title={t.pickup_location}>
                        <i className="fa fa-circle text-success mr-1" style={{ fontSize: 8 }} />
                        {t.pickup_location || 'Pickup'}
                      </div>
                      <div className="small text-truncate" style={{ maxWidth: 150 }} title={t.drop_location}>
                        <i className="fa fa-map-marker text-danger mr-1" style={{ fontSize: 10 }} />
                        {t.drop_location || 'Drop'}
                      </div>
                    </td>
                    <td>
                      {eta != null ? (
                        <span className="text-muted">{eta} mins</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <Badge color={delayed ? 'danger' : 'primary'}>
                        {t.status || state || 'Ongoing'}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No ongoing trips for this period
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default PanelTripsOngoing;
