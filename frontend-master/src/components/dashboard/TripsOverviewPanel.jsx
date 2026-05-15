import React, { useEffect, useState, useRef } from 'react';
import { Table, Badge } from 'reactstrap';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import PanelPagination from './PanelPagination';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getVehicleDisplay } from '../../utils/vehicleUtils';

// ── Filter display config ────────────────────────────────────────────────────
const FILTER_LABELS = {
  ongoing:   'Ongoing Trips',
  delayed:   'Delayed Trips',
  completed: 'Completed Trips',
  cancelled: 'Cancelled Trips',
};

const FILTER_ACCENT = {
  ongoing:   '#3b82f6',
  delayed:   '#ef4444',
  completed: '#10b981',
  cancelled: '#6b7280',
};

// Human-readable trip status labels
const STATUS_LABEL = {
  accepted:              'Accepted',
  night_confirmed:       'Night Confirmed',
  morning_confirmed:     'Morning Confirmed',
  route_sent:            'Route Sent',
  en_route_pickup:       'En Route to Pickup',
  at_pickup:             'At Pickup',
  loaded:                'Loaded',
  en_route_drop:         'En Route to Drop',
  at_drop:               'At Drop',
  unloaded:              'Unloaded',
  completed:             'Completed',
  cancelled:             'Cancelled',
  cancelled_by_customer: 'Cancelled by Customer',
};

// ── Shared styles ────────────────────────────────────────────────────────────
const styles = {
  wrapper:     { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
  subtitle:    { fontSize: '0.78rem', color: '#6b7280', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6b7280', fontSize: '0.875rem', gap: '8px' },
  emptyWrap:   { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: '0.875rem', flexDirection: 'column', gap: '8px' },
  tableWrap:   { flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:          { background: '#f9fafb', padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, whiteSpace: 'nowrap' },
  td:          { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'middle' },
  idBadge:     { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, fontSize: '0.76rem' },
  footer:      { marginTop: '10px', fontSize: '0.73rem', color: '#9ca3af', textAlign: 'center' },
};

// ── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" fill="none" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

// ── Delay type badge — exactly matches DelayedTripsPanel ─────────────────────
const getTypeBadge = (type, isEnroute) => {
  if (isEnroute) return <Badge color="primary" style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>🚗 Enroute Alert</Badge>;
  if (type === 'pickup_delay')      return <Badge color="warning">Pickup Delay</Badge>;
  if (type === 'destination_delay') return <Badge color="danger">Drop Delay</Badge>;
  if (type === 'completion_delay')  return <Badge color="info">Completion Delay</Badge>;
  return <Badge color="secondary">{type || '—'}</Badge>;
};

const formatOverdue = (minutes) => {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

// ── Delayed table — same format as DelayedTripsPanel ────────────────────────
const DelayedTable = ({ rows, onRowClick }) => (
  <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
    <Table borderless hover size="sm" className="mb-0">
      <thead className="sticky-top bg-light">
        <tr>
          <th className="text-muted border-bottom-0">Trip / Booking</th>
          <th className="text-muted border-bottom-0">Driver</th>
          <th className="text-muted border-bottom-0">Delay Type</th>
          <th className="text-muted border-bottom-0">Overdue</th>
          <th className="text-muted border-bottom-0 text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((row, i) => (
          <tr
            key={row.trip_id ?? i}
            onClick={onRowClick}
            style={{ cursor: 'pointer' }}
          >
            <td>
              <div><strong className="text-primary">{row.booking_id || '—'}</strong></div>
              <div className="small text-muted">Trip #{row.trip_id || '—'}</div>
            </td>
            <td>
              <div><span className="font-weight-bold">{getDriverDisplay(row)}</span></div>
              <div className="small text-muted">{row.vehicle_registration || '—'}</div>
            </td>
            <td>
              {getTypeBadge(row.escalation_type, row._isEnrouteAlert)}
              {row.severity === 'high' && <Badge color="danger" className="ml-1">High</Badge>}
            </td>
            <td className={row.severity === 'high' ? 'text-danger font-weight-bold' : ''}>
              {formatOverdue(row.time_overdue_minutes)}
            </td>
            <td className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                <a 
                  href={row.driver_phone ? `tel:${row.driver_phone}` : '#'} 
                  className={`btn btn-success btn-sm p-1 px-2 ${!row.driver_phone ? 'disabled' : ''}`}
                  title="Call Driver"
                >
                  <i className="fa fa-phone" />
                </a>
                {(row._isEnrouteAlert || row._isPickupDelayAlert || row._isDropDelayAlert) ? (
                  <button
                    className="btn btn-info btn-sm p-1 px-2 font-weight-bold"
                    onClick={() => onRowClick()}
                    title="Ops Agent"
                    style={{ fontSize: '0.75rem' }}
                  >
                    🤖 Ops Agent
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary btn-sm p-1 px-2"
                    onClick={() => onRowClick()}
                    title="View Escalation"
                  >
                    <i className="fa fa-eye" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        )) : (
          <tr>
            <td colSpan={4} className="text-center text-muted py-4">No delayed trips found</td>
          </tr>
        )}
      </tbody>
    </Table>
  </div>
);

// ── Route cell (pickup → drop) ────────────────────────────────────────────────
const RouteCell = ({ pickup, drop }) => (
  <td style={{ ...styles.td, minWidth: 140 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
        <span style={{ flexShrink: 0 }}>📍</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={pickup}>{pickup}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
        <span style={{ flexShrink: 0 }}>🎯</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={drop}>{drop}</span>
      </span>
    </div>
  </td>
);

// ── General trip table (ongoing / completed / cancelled) ─────────────────────
const GeneralTable = ({ rows, onRowClick }) => (
  <div style={styles.tableWrap}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Trip ID</th>
          <th style={styles.th}>Booking</th>
          <th style={styles.th}>Driver</th>
          <th style={styles.th}>Vehicle</th>
          <th style={styles.th}>Route</th>
          <th style={styles.th}>Pickup Time</th>
          <th style={styles.th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const rowBg = i % 2 === 0 ? '#fff' : '#f9fafb';
          const label = STATUS_LABEL[row.status] || row.status || '—';
          return (
            <tr
              key={row.trip_id ?? i}
              style={{ background: rowBg, cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={onRowClick}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
              title="Click to open Trips page"
            >
              <td style={styles.td}><span style={styles.idBadge}>#{row.trip_id ?? '—'}</span></td>
              <td style={styles.td}>
                {row.booking_id
                  ? <span style={{ ...styles.idBadge, background: '#f0fdf4', color: '#15803d' }}>#{row.booking_id}</span>
                  : '—'}
              </td>
              <td style={styles.td}>{getDriverDisplay(row)}</td>
              <td style={styles.td}>{getVehicleDisplay(row)}</td>
              <RouteCell pickup={row.pickup_location} drop={row.drop_location} />
              <td style={styles.td}>{row.pickup_time}</td>
              <td style={styles.td}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: '#f3f4f6', color: '#374151' }}>
                  {label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const TripsOverviewPanel = ({ filter, dateRange }) => {
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
  }, [filter, dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    if (!filter) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows([]);

    const params = new URLSearchParams({ type: 'trips', filter, page: String(page), limit: String(PAGE_LIMIT) });
    if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange?.endDate)   params.append('end_date',   dateRange.endDate);

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
        setError('Failed to load trip details. Please try again.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filter, dateRange?.startDate, dateRange?.endDate, page]);

  const accentColor = FILTER_ACCENT[filter] || '#6b7280';
  const isDelayed   = filter === 'delayed';
  const pagerVisible = totalCount > PAGE_LIMIT && totalPages > 1;

  return (
    <div style={styles.wrapper}>
      {/* ── Sub-header ── */}
      <div style={styles.subtitle}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
        <span>{FILTER_LABELS[filter] || 'Trips'}</span>
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
          <span style={{ fontSize: '1.5rem' }}>🚌</span>
          No trips found for this period.
        </div>
      )}

      {/* ── Table — delayed uses same format as DelayedTripsPanel ── */}
      {!loading && !error && rows.length > 0 && (
        <>
          {isDelayed
            ? <DelayedTable rows={rows} onRowClick={() => history.push('/app/trips/escalations')} />
            : <GeneralTable rows={rows} onRowClick={() => history.push('/app/trips')} />
          }

          {(!pagerVisible || isDelayed) && (
            <div style={styles.footer}>
              {!pagerVisible && (
                <>
                  Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
                  {isDelayed ? ' · ' : ''}
                </>
              )}
              {isDelayed && (
                <span
                  style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => history.push('/app/trips/escalations')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') history.push('/app/trips/escalations');
                  }}
                >
                  View all on Trip Escalations page ↗
                </span>
              )}
            </div>
          )}
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

export default TripsOverviewPanel;
