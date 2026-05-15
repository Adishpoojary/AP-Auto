import React, { useEffect, useState, useRef } from 'react';
import { Table, Badge } from 'reactstrap';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import PanelPagination from './PanelPagination';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getVehicleDisplay } from '../../utils/vehicleUtils';

// ── Filter display config ─────────────────────────────────────────────────────
const FILTER_LABELS = {
  total_vehicles:     'All Vehicles',
  available_vehicles: 'Available Vehicles',
  active_drivers:     'Active Drivers',
  available_drivers:  'Available Drivers',
  busy_drivers:       'Busy Drivers',
  offline_drivers:    'Offline Drivers',
};

const FILTER_ACCENT = {
  total_vehicles:     '#6b7280',
  available_vehicles: '#10b981',
  active_drivers:     '#10b981',
  available_drivers:  '#06b6d4',
  busy_drivers:       '#3b82f6',
  offline_drivers:    '#6b7280',
};

// ── Shared styles (mirrors TripsOverviewPanel / CustomerOverviewPanel) ─────────
const styles = {
  wrapper:     { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
  subtitle:    { fontSize: '0.78rem', color: 'var(--text-muted, #6b7280)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', alignItems: 'center', gap: 6 },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted, #6b7280)', fontSize: '0.875rem', gap: '8px' },
  emptyWrap:   { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', flexDirection: 'column', gap: '8px' },
  tableWrap:   { flex: 1, overflowY: 'auto' },
  footer:      { marginTop: '10px', fontSize: '0.73rem', className: 'text-muted', textAlign: 'center' },
};

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" fill="none" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { color: 'success', label: 'Active' },
  available: { color: 'info',    label: 'Available' },
  inactive:  { color: 'secondary', label: 'Offline' },
  blocked:   { color: 'danger',  label: 'Blocked' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { color: 'secondary', label: status || '—' };
  return (
    <Badge color={cfg.color} pill>
      {cfg.label}
    </Badge>
  );
};

// ── Fleet table ───────────────────────────────────────────────────────────────
const FleetTable = ({ rows, onRowClick }) => (
  <div style={styles.tableWrap}>
    <Table hover responsive size="sm" className="mb-0" style={{ fontSize: '0.8rem' }}>
      <thead>
        <tr>
          <th className="border-top-0 border-bottom-0 text-muted">Driver Name</th>
          <th className="border-top-0 border-bottom-0 text-muted">Vehicle</th>
          <th className="border-top-0 border-bottom-0 text-muted">Status</th>
          <th className="border-top-0 border-bottom-0 text-muted">Last Active</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.driver_id ?? i}
            style={{ cursor: 'pointer' }}
            onClick={() => onRowClick(row)}
            title="Click to view Vehicles page"
          >
            <td className="align-middle">
              <div className="font-weight-bold">{getDriverDisplay(row)}</div>
              <div className="small text-muted">{row.phone}</div>
            </td>
            <td className="align-middle">
              {getVehicleDisplay(row)}
            </td>
            <td className="align-middle">
              <StatusBadge status={row.status} />
            </td>
            <td className="align-middle small text-muted">
              {row.last_app_activity}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const FleetOverviewPanel = ({ filter, refreshTrigger }) => {
  const PAGE_LIMIT = 10;
  const [rows, setRows]       = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);
  const history               = useHistory();

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (!filter) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows([]);

    const params = new URLSearchParams({ type: 'fleet', filter, page: String(page), limit: String(PAGE_LIMIT) });

    axios
      .get(`${config.dispatchApiUrl}/dashboard/panel-overview?${params.toString()}`, {
        signal: controller.signal,
      })
      .then((res) => {
        setRows(res.data?.data || []);
        setTotalPages(Number(res.data?.total_pages || 1));
        setTotalCount(Number(res.data?.total_count || 0));
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError('Failed to load fleet details. Please try again.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filter, refreshTrigger, page]);

  const accentColor = FILTER_ACCENT[filter] || '#6b7280';
  const pagerVisible = totalCount > PAGE_LIMIT && totalPages > 1;

  return (
    <div style={styles.wrapper}>
      {/* ── Sub-header ── */}
      <div style={styles.subtitle}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
        <span>{FILTER_LABELS[filter] || 'Fleet'}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>Live</span>
      </div>

      {/* ── States ── */}
      {loading && <div style={styles.loadingWrap}><Spinner /> Loading…</div>}

      {!loading && error && (
        <div style={{ ...styles.emptyWrap, color: '#ef4444' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={styles.emptyWrap}>
          <span style={{ fontSize: '1.5rem' }}>🚛</span>
          No records found for this filter.
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && rows.length > 0 && (
        <>
          <FleetTable
            rows={rows}
            onRowClick={() => history.push('/app/dispatch/vehicles')}
          />
          <div style={styles.footer} className="text-muted">
            {!pagerVisible && (
              <>
                Showing {rows.length} record{rows.length !== 1 ? 's' : ''} · Real-time data ·{' '}
              </>
            )}
            {pagerVisible && <>Real-time data · </>}
            <span
              style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => history.push('/app/dispatch/vehicles')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') history.push('/app/dispatch/vehicles');
              }}
            >
              View all Vehicles ↗
            </span>
          </div>
          <PanelPagination
            page={page}
            totalPages={totalPages}
            limit={PAGE_LIMIT}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};

export default FleetOverviewPanel;
