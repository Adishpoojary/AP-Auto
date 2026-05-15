import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Badge } from 'reactstrap';
import config from '../../config';
import SkeletonCard from './SkeletonCard';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getVehicleDisplay } from '../../utils/vehicleUtils';

const dispatchApi = axios.create({
  baseURL: config.dispatchApiBase || 'http://localhost:8001/api',
  validateStatus: (s) => s >= 200 && s < 300,
});

/**
 * Fetches only when mounted (e.g. when drivers info panel opens).
 */
const ActiveDriversPanel = () => {
  const { dateRange } = useDateFilter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = dateRange?.startDate ? { date: dateRange.startDate } : {};
      const res = await dispatchApi.get('/dashboard/panel-active-drivers', { params });
      const data = res.data?.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('ActiveDriversPanel:', e);
      setError('Could not load drivers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && rows.length === 0) {
    return <SkeletonCard height="240px" />;
  }

  if (error) {
    return <div className="text-muted p-3">{error}</div>;
  }

  return (
    <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
      <Table borderless hover size="sm" className="mb-0">
        <thead className="sticky-top bg-light">
          <tr>
            <th className="text-muted border-bottom-0">Driver</th>
            <th className="text-muted border-bottom-0">Vehicle</th>
            <th className="text-muted border-bottom-0">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((d, i) => (
              <tr key={d.driver_id || d.id || i}>
                <td>
                  <div className="font-weight-bold">{getDriverDisplay(d)}</div>
                  <div className="small text-muted">{d.driver_phone || '—'}</div>
                </td>
                <td>{getVehicleDisplay(d)}</td>
                <td>
                  <Badge color={d.availability === 'busy' ? 'warning' : 'success'}>
                    {d.availability || d.status || 'Active'}
                  </Badge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="text-center text-muted py-4">
                No active drivers on map
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default ActiveDriversPanel;
