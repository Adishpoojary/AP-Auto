import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import config from '../../config';
import { useDateFilter } from '../../contexts/DateFilterContext';
import opsWebSocket from '../../services/opsWebSocket';
import PanelPagination from './PanelPagination';
import { getDriverDisplay } from '../../utils/driverUtils';
import { getCustomerDisplay } from '../../utils/customerUtils';

const FILTER_LABELS = {
  assigned:   'Assigned Bookings',
  unassigned: 'Unassigned Bookings',
  pending:    'Pending Bookings',
  completed:  'Completed Bookings',
  cancelled:  'Cancelled Bookings',
};

const STATUS_BADGE_COLOR = {
  assigned:   '#3b82f6',
  unassigned: '#ef4444',
  pending:    '#f59e0b',
  completed:  '#10b981',
  cancelled:  '#6b7280',
};

const PRIORITY_STYLE = {
  CRITICAL: { backgroundColor: '#d32f2f', color: 'white', boxShadow: '0 2px 4px rgba(211, 47, 47, 0.3)' },
  MEDIUM:   { backgroundColor: '#f57c00', color: 'white', boxShadow: '0 2px 4px rgba(245, 124, 0, 0.3)' },
  LOW:      { backgroundColor: '#1976d2', color: 'white', boxShadow: '0 2px 4px rgba(25, 118, 210, 0.3)' },
};

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
  subtitle: { fontSize: '0.78rem', color: '#6b7280', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6b7280', fontSize: '0.875rem', gap: '8px' },
  emptyWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: '0.875rem', flexDirection: 'column', gap: '8px' },
  tableWrap: { flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { background: '#f9fafb', padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'middle' },
  idBadge: { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, fontSize: '0.76rem' },
  footer: { marginTop: '10px', fontSize: '0.73rem', color: '#9ca3af', textAlign: 'center' },
  clickableRow: { cursor: 'pointer', transition: 'background 0.15s' },
};

function lookupByBookingId(map, bookingId) {
  if (!map || bookingId === undefined || bookingId === null) return undefined;
  const b = String(bookingId);
  const n = Number(b);
  return map[bookingId] ?? map[b] ?? (Number.isFinite(n) ? map[n] : undefined);
}

/** Match EscalationDashboard Agent column (lines 776–778): rec OR rejected OR zone. */
function bookingHasOpsAgentFromWs(bookingId, recs, rejected, zones) {
  if (bookingId === undefined || bookingId === null) return false;
  const b = String(bookingId);
  const hasRec = (recs || []).some((r) => String(r.booking_id) === b);
  const hasRejected = Boolean(lookupByBookingId(rejected, bookingId));
  const z = lookupByBookingId(zones, bookingId);
  const hasZone = Array.isArray(z) && z.length > 0;
  return hasRec || hasRejected || hasZone;
}

const Spinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" fill="none" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

/** Two-line pickup → drop column used in both table variants */
const RouteCell = ({ pickup, drop, tdStyle }) => (
  <td style={{ ...tdStyle, minWidth: 140 }}>
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
          <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={pickup}>{pickup}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
          <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>🎯</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={drop}>{drop}</span>
        </span>
      </div>
    </div>
  </td>
);

/**
 * Rich table for live unassigned bookings — mirrors the Unassigned Bookings page.
 * Columns: Priority · Booking ID · Route · Vehicle · Distance · Pickup Time · Agent
 * Clicking a row navigates to /app/operations/escalation.
 */
const LiveUnassignedTable = ({ rows, onRowClick }) => (
  <div style={styles.tableWrap}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Priority</th>
          <th style={styles.th}>Booking ID</th>
          <th style={styles.th}>Route</th>
          <th style={styles.th}>Vehicle</th>
          <th style={styles.th}>Distance</th>
          <th style={styles.th}>Pickup Time</th>
          <th style={styles.th}>Agent</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const priorityFullText = String(row.priority || '').toUpperCase();
          let pStyle = PRIORITY_STYLE.LOW; // fallback
          if (priorityFullText.includes('CRITICAL')) pStyle = PRIORITY_STYLE.CRITICAL;
          else if (priorityFullText.includes('MEDIUM')) pStyle = PRIORITY_STYLE.MEDIUM;
          else if (priorityFullText.includes('LOW')) pStyle = PRIORITY_STYLE.LOW;

          return (
            <tr
              key={row.booking_id ?? i}
              style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={() => onRowClick()}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb')}
              title="Click to open Unassigned Bookings page"
            >
              <td style={styles.td}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, ...pStyle }}>
                  {priorityFullText || '—'}
                </span>
              </td>
              <td style={styles.td}>
                <span style={styles.idBadge}>#{row.booking_id}</span>
              </td>
              <RouteCell pickup={row.pickup_location} drop={row.drop_location} tdStyle={styles.td} />
              <td style={styles.td}>{row.vehicle_type}</td>
              <td style={styles.td}>
                {row.distance_km != null ? `${Number(row.distance_km).toFixed(1)} km` : '—'}
              </td>
              <td style={styles.td}>{row.pickup_time}</td>
              <td style={styles.td}>
                {row.has_agent ? (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    background: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)', 
                    color: 'white', 
                    boxShadow: '0 2px 4px rgba(76, 175, 80, 0.3)', 
                    borderRadius: '6px', 
                    padding: '4px 10px', 
                    fontSize: '0.74rem', 
                    fontWeight: 700 
                  }}>
                    🤖 Ops Agent
                  </span>
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/**
 * Standard table for DB-sourced bookings (assigned / pending / completed / cancelled / historical unassigned).
 */
const StandardTable = ({ rows, accentColor, onRowClick }) => (
  <div style={styles.tableWrap}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Booking ID</th>
          <th style={styles.th}>Customer</th>
          <th style={styles.th}>Driver</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Pickup Time</th>
          <th style={styles.th}>Route</th>
          <th style={styles.th}>Vehicle</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.booking_id ?? i}
            style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', cursor: 'pointer', transition: 'background 0.15s' }}
            onClick={onRowClick}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb')}
            title="Click to open Bookings page"
          >
            <td style={styles.td}><span style={styles.idBadge}>#{row.booking_id}</span></td>
            <td style={styles.td}>{getCustomerDisplay(row)}</td>
            <td style={styles.td}>{getDriverDisplay(row)}</td>
            <td style={styles.td}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: accentColor + '18', color: accentColor }}>
                {row.state}
              </span>
            </td>
            <td style={styles.td} title={row.pickup_time}>{row.pickup_time}</td>
            <RouteCell pickup={row.pickup_location} drop={row.drop_location} tdStyle={styles.td} />
            <td style={styles.td}>{row.vehicle_type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * BookingOverviewPanel
 * Fetches & displays individual booking records for the selected filter.
 * Rendered inside InfoPanel's body area.
 *
 * @param {{ filter: string, dateRange: { startDate?: string, endDate?: string }, useLive: boolean }} props
 */
const BookingOverviewPanel = ({ filter, dateRange, useLive }) => {
  const PAGE_LIMIT = 10;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [opsRecommendations, setOpsRecommendations] = useState([]);
  const [rejectedDrivers, setRejectedDrivers] = useState({});
  const [zoneDrivers, setZoneDrivers] = useState({});
  
  const abortRef = useRef(null);
  const history = useHistory();
  const { isDateInRange } = useDateFilter();

  const isLiveUnassigned = filter === 'unassigned' && useLive;

  useEffect(() => {
    setPage(1);
  }, [filter, dateRange?.startDate, dateRange?.endDate, useLive]);

  useEffect(() => {
    if (!filter) return;

    if (isLiveUnassigned) {
      setLoading(true);
      setError(null);
      setSource('live');
      setRows([]);
      setOpsRecommendations([]);
      setRejectedDrivers({});
      setZoneDrivers({});

      const unsubOpen = opsWebSocket.onConnected(() => setLoading(false));
      const controller = new AbortController();

      const fetchLiveRows = async () => {
        try {
          const params = new URLSearchParams({ filter, page: String(page), limit: String(PAGE_LIMIT), use_live: 'true' });
          if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
          if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
          const res = await axios.get(
            `${config.dispatchApiUrl}/dashboard/panel-overview?${params.toString()}`,
            { signal: controller.signal }
          );
          setRows(Array.isArray(res.data?.data) ? res.data.data : []);
          setTotalCount(Number(res.data?.total_count || 0));
          setTotalPages(Number(res.data?.total_pages || 1));
          setSource(res.data?.source || 'live');
        } catch (err) {
          if (!axios.isCancel(err)) {
            setError('Failed to load live unassigned bookings. Please try again.');
          }
        } finally {
          setLoading(false);
        }
      };
      fetchLiveRows();

      const onEscalation = (data) => {
        if (!Array.isArray(data.unassigned)) return;
        setTotalCount(data.unassigned.length);
        setTotalPages(Math.max(1, Math.ceil(data.unassigned.length / PAGE_LIMIT)));
        const startIdx = (page - 1) * PAGE_LIMIT;
        const pageRows = data.unassigned.slice(startIdx, startIdx + PAGE_LIMIT);
        setRows((prev) => {
          const prevAgentByBooking = new Map(
            prev.map((row) => [String(row.booking_id), Boolean(row.has_agent)])
          );
          return pageRows.map((row) => {
            const bid = String(row.booking_id);
            return {
              ...row,
              has_agent: row.has_agent ?? prevAgentByBooking.get(bid) ?? false,
            };
          });
        });
      };
      const onClear = () => {
        setRows([]);
        setTotalCount(0);
        setTotalPages(1);
        setOpsRecommendations([]);
        setRejectedDrivers({});
        setZoneDrivers({});
      };
      const onOpsRec = (data) => {
        if (data.recommendations !== undefined) {
          setOpsRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
        }
        if (data.rejected_drivers) setRejectedDrivers(data.rejected_drivers);
        if (data.zone_drivers) setZoneDrivers(data.zone_drivers);
      };

      const u1 = opsWebSocket.subscribe('escalation', onEscalation);
      const u2 = opsWebSocket.subscribe('clear_all', onClear);
      const u3 = opsWebSocket.subscribe('ops_recommendation', onOpsRec);

      return () => {
        controller.abort();
        unsubOpen();
        u1();
        u2();
        u3();
      };
    } else {
      // ── REST API MODE FOR OTHER FILTERS ──
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setRows([]);

      const params = new URLSearchParams({ filter, page: String(page), limit: String(PAGE_LIMIT) });
      if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
      if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
      params.append('use_live', useLive ? 'true' : 'false');

      axios
        .get(`${config.dispatchApiUrl}/dashboard/panel-overview?${params.toString()}`, {
          signal: controller.signal,
        })
        .then((res) => {
          setRows(res.data?.data || []);
          setTotalCount(Number(res.data?.total_count || 0));
          setTotalPages(Number(res.data?.total_pages || 1));
          setSource(res.data?.source || null);
        })
        .catch((err) => {
          if (axios.isCancel(err)) return;
          setError('Failed to load details. Please try again.');
        })
        .finally(() => setLoading(false));

      return () => controller.abort();
    }
  }, [filter, dateRange?.startDate, dateRange?.endDate, useLive, isLiveUnassigned, page]);

  const displayRows = useMemo(() => {
    if (!isLiveUnassigned) return rows;
    return rows
      .filter((row) => {
        const bookingDate = row.pickup_time || row.created_at;
        return !bookingDate || isDateInRange(bookingDate);
      })
      .map((row) => {
        const fromWs = bookingHasOpsAgentFromWs(
          row.booking_id,
          opsRecommendations,
          rejectedDrivers,
          zoneDrivers
        );
        return {
          ...row,
          drop_location: row.dropoff_location || row.drop_location || '—',
          pickup_location: row.pickup_location || '—',
          has_agent: fromWs || Boolean(row.has_agent),
        };
      });
  }, [isLiveUnassigned, rows, isDateInRange, opsRecommendations, rejectedDrivers, zoneDrivers]);

  const accentColor = STATUS_BADGE_COLOR[filter] || '#6b7280';
  const pagerVisible = totalCount > PAGE_LIMIT && totalPages > 1;

  return (
    <div style={styles.wrapper}>
      {/* Header bar */}
      <div style={styles.subtitle}>
        <span>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, marginRight: 6, verticalAlign: 'middle' }} />
          {FILTER_LABELS[filter] || 'Bookings'}
        </span>
        {source === 'live' && (
          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, letterSpacing: '0.03em' }}>
            ● Live Feed
          </span>
        )}
      </div>

      {loading && <div style={styles.loadingWrap}><Spinner /> Loading…</div>}

      {!loading && error && (
        <div style={{ ...styles.emptyWrap, color: '#ef4444' }}><span>⚠️</span> {error}</div>
      )}

      {!loading && !error && displayRows.length === 0 && (
        <div style={styles.emptyWrap}>
          <span style={{ fontSize: '1.5rem' }}>📭</span>
          No records found for this period.
        </div>
      )}

      {!loading && !error && displayRows.length > 0 && (
        <>
          {isLiveUnassigned ? (
            <LiveUnassignedTable
              rows={displayRows}
              onRowClick={() => history.push('/app/operations/escalation')}
            />
          ) : (
            <StandardTable
              rows={displayRows}
              accentColor={accentColor}
              onRowClick={() => history.push('/app/bookings')}
            />
          )}
          {(!pagerVisible || isLiveUnassigned) && (
            <div style={styles.footer}>
              {!pagerVisible && (
                <>
                  Showing {displayRows.length} record{displayRows.length !== 1 ? 's' : ''}
                  {isLiveUnassigned ? ' · ' : ''}
                </>
              )}
              {isLiveUnassigned && (
                <span
                  style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => history.push('/app/operations/escalation')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') history.push('/app/operations/escalation');
                  }}
                >
                  View all on Unassigned page ↗
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

export default BookingOverviewPanel;
