import React, { useEffect, useState, useRef } from 'react';
import { Table, Badge } from 'reactstrap';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import { useCity } from '../../contexts/CityContext';
import { fetchDriverEscalationSnapshot } from '../../actions/driverIssues';
import PanelPagination from './PanelPagination';
import { getDriverDisplay } from '../../utils/driverUtils';

// ── Filter display config ────────────────────────────────────────────────────
const FILTER_LABELS = {
  driver_issues:       'Driver Issues',
  customer_complaints: 'Customer Complaints',
  payment_disputes:    'Payment Disputes',
  trip_issues:         'Trip Issues',
  technical_issues:    'Technical Issues',
};

const FILTER_ACCENT = {
  driver_issues:       '#dc3545',
  customer_complaints: '#ffc107',
  payment_disputes:    '#6f42c1',
  trip_issues:         '#17a2b8',
  technical_issues:    '#6c757d',
};

// Same semantics as Notifications.js — breakdown-details supports mismatch + generic location_issue.
const AGENT_SUPPORTED_TYPES = [
  'vehicle_breakdown',
  'service_refusal',
  'accident',
  'delay',
  'location_mismatch_pickup',
  'location_mismatch_drop',
  'location_issue',
  'customer_issue',
  'request_team_call',
];

const driverStatusHasOpsAgent = (driverStatus) => {
  if (!driverStatus || typeof driverStatus !== 'string') return false;
  if (AGENT_SUPPORTED_TYPES.includes(driverStatus)) return true;
  // Catch any future location_mismatch_* values from the app without duplicating lists.
  return driverStatus.startsWith('location_mismatch');
};

const formatDriverStatus = (status) => {
  if (!status) return 'Issue Reported';
  return status.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getSeverityKey = (driverStatus) => {
  if (!driverStatus) return 'medium';
  const s = driverStatus.toLowerCase();
  if (s.includes('accident') || s.includes('emergency') || s.includes('major') || s.includes('medical')) return 'critical';
  if (s.includes('breakdown') || s.includes('engine') || s.includes('blocked')) return 'high';
  return 'medium';
};

const SEVERITY_BADGE = {
  critical: { bg: '#dc3545', color: '#fff', label: 'CRITICAL' },
  high: { bg: '#ffc107', color: '#333', label: 'HIGH' },
  medium: { bg: '#0d6efd', color: '#fff', label: 'MEDIUM' },
};

const agentBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
  color: 'white',
  boxShadow: '0 2px 4px rgba(76, 175, 80, 0.3)',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '0.72rem',
  fontWeight: 700,
};

const btnOutline = {
  padding: '4px 10px',
  fontSize: '0.72rem',
  borderRadius: '6px',
  border: '1px solid #dee2e6',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const btnResolve = {
  ...btnOutline,
  border: '1px solid #20c997',
  background: '#d1f4ea',
  color: '#0d503c',
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

// ── Date formatter ───────────────────────────────────────────────────────────
const formatTime = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.valueOf())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch (e) {
    return isoString;
  }
};

// ── General Table ────────────────────────────────────────────────────────────
const GeneralTable = ({ rows, onRowClick }) => (
  <div style={styles.tableWrap}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Issue Type</th>
          <th style={styles.th}>Booking & Trip</th>
          <th style={styles.th}>Driver</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const rowBg = i % 2 === 0 ? '#fff' : '#f9fafb';
          const isEscalated = row.status && row.status.toLowerCase().includes('escalated');
          
          return (
            <tr
              key={row.id ?? i}
              style={{ background: rowBg, transition: 'background 0.15s', cursor: 'pointer' }}
              onClick={onRowClick}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
              title="Click to view notifications"
            >
              <td style={styles.td}>
                <span style={{ fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '2px' }}>
                  {row.issue_type || '—'}
                </span>
                {row.pickup_location && row.drop_location && (
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    📍 {row.pickup_location} ⟶ {row.drop_location}
                  </span>
                )}
              </td>
              <td style={styles.td}>
                {row.booking_id ? (
                  <div>
                    <span style={{ ...styles.idBadge, background: '#f0fdf4', color: '#15803d' }}>
                      B: #{row.booking_id}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af' }}>No Booking</div>
                )}
                <div style={{ marginTop: '3px' }}>
                  {row.trip_id ? (
                    <span style={styles.idBadge}>T: #{row.trip_id}</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>No Trip</span>
                  )}
                </div>
              </td>
              <td style={styles.td}>
                <div>{getDriverDisplay(row)}</div>
              </td>
              <td style={styles.td}>
                {isEscalated ? (
                  <Badge color="danger">Escalated</Badge>
                ) : (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: '#f3f4f6', color: '#374151' }}>
                    {row.status || 'Resolved'}
                  </span>
                )}
              </td>
              <td style={styles.td}>{formatTime(row.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ── Driver Issues: mirrors Notifications.js semantics (no agent_* fields on API) ──
const DriverIssuesTable = ({ rows, history }) => (
  <div style={styles.tableWrap}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Issue</th>
          <th style={styles.th}>Booking &amp; Trip</th>
          <th style={styles.th}>Driver</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Actions</th>
          <th style={styles.th}>Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const rowBg = i % 2 === 0 ? '#fff' : '#f9fafb';
          const sev = getSeverityKey(row.driver_status);
          const sevStyle = SEVERITY_BADGE[sev] || SEVERITY_BADGE.medium;
          const hasOpsAgent = !row.is_alert && driverStatusHasOpsAgent(row.driver_status);

          return (
            <tr
              key={row.id ?? i}
              style={{ background: rowBg, transition: 'background 0.15s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = rowBg;
              }}
            >
              <td style={styles.td}>
                <span style={{ fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  {row.is_alert ? row.display_title : formatDriverStatus(row.driver_status)}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  {row.issue_type}
                </span>
                {row.pickup_location && row.drop_location && (
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    📍 {String(row.pickup_location).split(',')[0]} ⟶ {String(row.drop_location).split(',')[0]}
                  </span>
                )}
                {!row.is_alert && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: sevStyle.bg,
                        color: sevStyle.color,
                      }}
                    >
                      {sevStyle.label}
                    </span>
                    {row.trip_status && (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          background: '#f3f4f6',
                          color: '#374151',
                        }}
                      >
                        {row.trip_status}
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td style={styles.td}>
                {row.booking_id ? (
                  <div>
                    <span style={{ ...styles.idBadge, background: '#f0fdf4', color: '#15803d' }}>
                      B: #{row.booking_id}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af' }}>No Booking</div>
                )}
                <div style={{ marginTop: '3px' }}>
                  {row.trip_id ? (
                    <span style={styles.idBadge}>T: #{row.trip_id}</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>No Trip</span>
                  )}
                </div>
              </td>
              <td style={styles.td}>
                <div>{getDriverDisplay(row)}</div>
              </td>
              <td style={styles.td}>
                {row.status && String(row.status).toLowerCase().includes('escalated') ? (
                  <Badge color="danger">Escalated</Badge>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: '#f3f4f6',
                      color: '#374151',
                    }}
                  >
                    {row.status || '—'}
                  </span>
                )}
              </td>
              <td style={styles.td}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                  {row.driver_phone && (
                    <a
                      href={`tel:${row.driver_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ ...btnOutline, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="Call driver"
                    >
                      📞 Call
                    </a>
                  )}
                  {hasOpsAgent && (
                    <button
                      type="button"
                      style={{ ...btnOutline, borderColor: '#43a047', color: '#2e7d32' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        history.push('/app/notifications');
                      }}
                    >
                      🤖 Ops Agent
                    </button>
                  )}
                  <button
                    type="button"
                    style={btnResolve}
                    onClick={(e) => {
                      e.stopPropagation();
                      history.push('/app/notifications');
                    }}
                  >
                    Resolve
                  </button>
                </div>
              </td>
              <td style={styles.td}>{formatTime(row.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const EscalationsOverviewPanel = ({ filter, dateRange }) => {
  const PAGE_LIMIT = 10;
  const [rows, setRows]       = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);
  const allDriverRowsRef      = useRef([]);
  const history               = useHistory();
  const { selectedCities } = useCity();

  useEffect(() => {
    setPage(1);
  }, [filter, dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    if (!filter) return;

    setLoading(true);
    setError(null);
    setRows([]);

    if (filter === 'driver_issues') {
      let mounted = true;
      fetchDriverEscalationSnapshot({
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
        cities: selectedCities,
      })
        .then((snapshot) => {
          if (!mounted) return;
          const issueRows = snapshot.issues.map((issue) => ({
            id: issue.id,
            is_alert: false,
            driver_status: issue.driver_status,
            issue_type: issue.driver_status || issue.issue_type || 'driver_issue',
            display_title: formatDriverStatus(issue.driver_status),
            booking_id: issue.booking_id,
            trip_id: issue.trip_id,
            driver_name: issue.driver_name,
            driver_phone: issue.driver_phone,
            trip_status: issue.trip_status,
            customer_name: '—',
            status: issue.ops_status || 'reported',
            created_at: issue.created_at,
            pickup_location: issue.pickup_location,
            drop_location: issue.drop_location,
          }));
          const alertRows = snapshot.alerts.map((alert) => ({
            id: `alert_${alert.id}`,
            is_alert: true,
            driver_status: null,
            issue_type: `onboarding_${alert.document_type || 'document'}`,
            display_title: `Missing ${(alert.document_type || 'document').toString().toUpperCase()}`,
            booking_id: null,
            trip_id: null,
            driver_name: alert.driver_name || 'Unknown Driver',
            driver_phone: alert.phone_number,
            trip_status: null,
            customer_name: '—',
            status: alert.resolved ? 'resolved' : 'reported',
            created_at: alert.created_at,
            pickup_location: null,
            drop_location: null,
          }));
          const merged = [...issueRows, ...alertRows].sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          allDriverRowsRef.current = merged;
          const total = merged.length;
          setTotalCount(total);
          setTotalPages(Math.max(1, Math.ceil(total / PAGE_LIMIT)));
          setRows(merged.slice(0, PAGE_LIMIT));
        })
        .catch(() => setError('Failed to load escalation details. Please try again.'))
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams({ type: 'escalations', filter: filter, page: String(page), limit: String(PAGE_LIMIT) });
    if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
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
        setError('Failed to load escalation details. Please try again.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filter, dateRange?.startDate, dateRange?.endDate, selectedCities]);

  // Re-slice cached driver rows when page changes (no re-fetch needed).
  useEffect(() => {
    if (filter !== 'driver_issues') return;
    const all = allDriverRowsRef.current;
    if (!all.length) return;
    const start = (page - 1) * PAGE_LIMIT;
    setRows(all.slice(start, start + PAGE_LIMIT));
  }, [filter, page]);

  const accentColor = FILTER_ACCENT[filter] || '#6b7280';
  const pagerVisible = totalCount > PAGE_LIMIT && totalPages > 1;

  return (
    <div style={styles.wrapper}>
      {/* ── Sub-header ── */}
      <div style={styles.subtitle}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
        <span>{FILTER_LABELS[filter] || 'Escalations'}</span>
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
          <span style={{ fontSize: '1.5rem' }}>✅</span>
          No escalations found for this category.
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && rows.length > 0 && (
        <>
          {filter === 'driver_issues' ? (
            <DriverIssuesTable rows={rows} history={history} />
          ) : (
            <GeneralTable
              rows={rows}
              onRowClick={() => {
                if (filter === 'trip_issues') {
                  history.push('/app/trips/escalations');
                } else {
                  history.push('/app/notifications');
                }
              }}
            />
          )}

          {filter === 'driver_issues' && (
            <div style={styles.footer}>
              <span
                style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => history.push('/app/notifications')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') history.push('/app/notifications');
                }}
              >
                Open Operations Center for full actions ↗
              </span>
            </div>
          )}
          {!pagerVisible && filter !== 'driver_issues' && (
            <div style={styles.footer}>
              Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
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

export default EscalationsOverviewPanel;
