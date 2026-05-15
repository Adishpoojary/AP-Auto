import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import config from '../../config';

// ─── API clients ──────────────────────────────────────────────────────────────
const dispatchApi = axios.create({ baseURL: config.dispatchApiUrl });
const opsApi      = axios.create({ baseURL: config.opsApiBase });

// ─── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 10; // seconds

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  wrapper:    { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif', gap: 0 },
  toolbar:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tabBtn:     {
    base: { padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', transition: 'all 0.15s' },
    active: { background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' },
    idle:   { background: '#fff', color: '#374151' },
  },
  searchBox:  { flex: 1, minWidth: 160, padding: '5px 10px', fontSize: '0.78rem', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: '0.78rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' },
  info:       { fontSize: '0.75rem', color: '#6b7280', marginBottom: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, border: '1px solid #dbeafe' },
  tableWrap:  { flex: 1, overflowY: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:         { background: '#f9fafb', padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, whiteSpace: 'nowrap', zIndex: 1 },
  td:         { padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'middle' },
  idBadge:    { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontWeight: 600, fontSize: '0.73rem' },
  loading:    { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6b7280', fontSize: '0.875rem', gap: 8, padding: 32 },
  empty:      { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: '0.875rem', flexDirection: 'column', gap: 8, padding: 32 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0 0', gap: 16, borderTop: '1px solid #e5e7eb', marginTop: 8 },
  pageBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.2s' },
  footer:     { marginTop: 8, fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right' },
};

// ─── Mini Components ──────────────────────────────────────────────────────────
const Spinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" fill="none" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

const VehicleBadge = ({ type }) => {
  const colors = { class1: '#dc2626', class2: '#2563eb', class3: '#16a34a', class4: '#d97706', class5: '#0891b2', class6: '#7c3aed', class7: '#374151' };
  const bg = colors[type] || '#6b7280';
  return (
    <span style={{ display: 'inline-block', background: bg + '18', color: bg, border: `1px solid ${bg}44`, borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>
      {type || 'N/A'}
    </span>
  );
};

const AgentBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg, #66bb6a, #43a047)', color: '#fff', boxShadow: '0 2px 4px rgba(76,175,80,0.3)', borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
    🤖 Ops Agent
  </span>
);

const UrgencyBadge = ({ minutes }) => {
  if (minutes == null) return <span style={{ color: '#9ca3af' }}>N/A</span>;
  const urgent = minutes <= 30;
  return (
    <span style={{ display: 'inline-block', background: urgent ? '#fee2e2' : '#dbeafe', color: urgent ? '#dc2626' : '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600 }}>
      {minutes} min
    </span>
  );
};

const FailedBadge = ({ count }) => (
  <span style={{ display: 'inline-block', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600 }}>
    {count || 1}
  </span>
);

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtDate = (str) => {
  if (!str) return 'N/A';
  try {
    return new Date(str).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return str; }
};

const truncate = (str, n = 35) => (!str ? 'N/A' : str.length > n ? str.slice(0, n) + '…' : str);

// ─── Regular Unassigned Table ─────────────────────────────────────────────────
const RegularTable = ({ rows, opsAgentTriggers, onRowClick }) => (
  <div style={s.tableWrap}>
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Booking ID</th>
          <th style={s.th}>Vehicle Type</th>
          <th style={s.th}>Suggested Vehicle</th>
          <th style={s.th}>Pickup Location</th>
          <th style={s.th}>Drop Location</th>
          <th style={s.th}>Pickup Time</th>
          <th style={s.th}>Distance</th>
          <th style={s.th}>Duration</th>
          <th style={s.th}>Fare</th>
          <th style={s.th}>Agent</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => {
          const id = b.id || b.booking_id;
          const hasAgent = opsAgentTriggers.some(t => (t.booking?.booking_id || t.booking?.id) === id);
          return (
            <tr
              key={id ?? i}
              style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={() => onRowClick()}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb')}
              title="Click to open Unlocked Bookings page"
            >
              <td style={s.td}><span style={s.idBadge}>#{id}</span></td>
              <td style={s.td}><VehicleBadge type={b.vehicle_type} /></td>
              <td style={s.td}>
                {b.assigned_vehicle_id
                  ? <><strong>#{b.assigned_vehicle_id}</strong> <VehicleBadge type={b.assigned_vehicle_type} /></>
                  : <span style={{ color: '#9ca3af', fontSize: '0.73rem' }}>— Not Assigned</span>}
              </td>
              <td style={s.td}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>📍</span>
                  <span title={b.pickup_location}>{truncate(b.pickup_location)}</span>
                </span>
              </td>
              <td style={s.td}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>🎯</span>
                  <span title={b.drop_location}>{truncate(b.drop_location)}</span>
                </span>
              </td>
              <td style={s.td}>{fmtDate(b.pickup_time)}</td>
              <td style={s.td}>{b.distance != null ? `${Number(b.distance).toFixed(1)} km` : 'N/A'}</td>
              <td style={s.td}>{b.duration != null ? `${Math.round(b.duration)} min` : 'N/A'}</td>
              <td style={s.td}>
                <strong style={{ color: '#15803d' }}>
                  {b.payment_estimate != null ? `₹${Number(b.payment_estimate).toFixed(2)}` : 'N/A'}
                </strong>
              </td>
              <td style={s.td}>{hasAgent ? <AgentBadge /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// ─── Hourly Unassigned Table ──────────────────────────────────────────────────
const HourlyTable = ({ rows, onRowClick }) => (
  <div style={s.tableWrap}>
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Booking ID</th>
          <th style={s.th}>Vehicle Class</th>
          <th style={s.th}>Pickup Location</th>
          <th style={s.th}>Pickup Time</th>
          <th style={s.th}>Duration</th>
          <th style={s.th}>Failed Attempts</th>
          <th style={s.th}>Minutes to Pickup</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => (
          <tr
            key={b.booking_id ?? i}
            style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', cursor: 'pointer', transition: 'background 0.15s' }}
            onClick={() => onRowClick()}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb')}
            title="Click to open Unlocked Bookings page"
          >
            <td style={s.td}><span style={s.idBadge}>#{b.booking_id}</span></td>
            <td style={s.td}>
              <span style={{ background: '#fef9c3', color: '#92400e', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>
                Class {b.vehicle_class_id || 'N/A'}
              </span>
            </td>
            <td style={s.td}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📍</span><span title={b.pickup_location}>{truncate(b.pickup_location)}</span>
              </span>
            </td>
            <td style={s.td}>{fmtDate(b.pickup_time)}</td>
            <td style={s.td}>{b.duration != null ? `${b.duration} min` : 'N/A'}</td>
            <td style={s.td}><FailedBadge count={b.failed_attempts} /></td>
            <td style={s.td}><UrgencyBadge minutes={b.minutes_to_pickup} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Main Panel ───────────────────────────────────────────────────────────────
const UnlockedBookingsPanel = () => {
  const history = useHistory();

  const [activeTab, setActiveTab]            = useState('regular');
  const [searchTerm, setSearchTerm]          = useState('');
  const [regularRows, setRegularRows]        = useState([]);
  const [hourlyRows, setHourlyRows]          = useState([]);
  const [opsAgentTriggers, setOpsAgentTriggers] = useState([]);
  const [loadingRegular, setLoadingRegular]  = useState(true);
  const [loadingHourly, setLoadingHourly]    = useState(true);
  const [error, setError]                    = useState(null);
  const [lastUpdated, setLastUpdated]        = useState(null);
  const [nextRefreshIn, setNextRefreshIn]    = useState(REFRESH_INTERVAL);
  const [currentPage, setCurrentPage]        = useState(1);
  const ITEMS_PER_PAGE = 20;

  // ── Fetchers ──
  const fetchRegular = useCallback(async () => {
    setLoadingRegular(true);
    setError(null);
    try {
      const res = await dispatchApi.get('/unlocked-bookings');
      if (res.data?.success) {
        setRegularRows(res.data.data || []);
        setLastUpdated(res.data.timestamp);
        setNextRefreshIn(REFRESH_INTERVAL);
      } else {
        throw new Error('Failed to fetch unlocked bookings');
      }
    } catch (err) {
      console.error('UnlockedBookingsPanel regular fetch error:', err);
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch unlocked bookings');
    } finally {
      setLoadingRegular(false);
    }
  }, []);

  const fetchHourly = useCallback(async () => {
    setLoadingHourly(true);
    try {
      const res = await opsApi.get('/hourly-unassigned-bookings');
      if (res.data?.success) {
        setHourlyRows(res.data.data || []);
      }
    } catch (err) {
      console.warn('Hourly unassigned endpoint not available:', err.message);
      setHourlyRows([]);
    } finally {
      setLoadingHourly(false);
    }
  }, []);

  const fetchOpsAgentTriggers = useCallback(async () => {
    try {
      const res = await dispatchApi.get('/ops-agent-triggers');
      if (res.data?.success) setOpsAgentTriggers(res.data.data || []);
    } catch (_) {}
  }, []);

  const refreshAll = useCallback(() => {
    fetchRegular();
    fetchHourly();
    fetchOpsAgentTriggers();
  }, [fetchRegular, fetchHourly, fetchOpsAgentTriggers]);

  // ── Initial fetch ──
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ── Auto-refresh every 10 s ──
  useEffect(() => {
    const interval = setInterval(refreshAll, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ── Countdown ──
  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefreshIn(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Reset page when tab or search changes ──
  useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm]);

  // ── Filter helpers ──
  const filterRegular = (rows) => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(b =>
      String(b.id || b.booking_id).includes(q) ||
      (b.pickup_location || '').toLowerCase().includes(q) ||
      (b.drop_location || '').toLowerCase().includes(q) ||
      (b.vehicle_type || '').toLowerCase().includes(q) ||
      String(b.assigned_vehicle_id || '').includes(q)
    );
  };

  const filterHourly = (rows) => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(b =>
      String(b.booking_id || '').includes(q) ||
      String(b.vehicle_class_id || '').includes(q) ||
      (b.pickup_location || '').toLowerCase().includes(q)
    );
  };

  const filteredRegular = filterRegular(regularRows);
  const filteredHourly  = filterHourly(hourlyRows);
  const activeData      = activeTab === 'hourly' ? filteredHourly : filteredRegular;
  const totalPages      = Math.max(1, Math.ceil(activeData.length / ITEMS_PER_PAGE));
  const pagedData       = activeData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isLoading = activeTab === 'regular' ? loadingRegular : loadingHourly;

  const fmtLastUpdated = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString('en-IN'); } catch (_) { return ''; }
  };

  const navToPage = () => history.push('/app/unlocked-bookings');

  return (
    <div style={s.wrapper}>
      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        {/* Tabs */}
        <button
          style={{ ...s.tabBtn.base, ...(activeTab === 'regular' ? s.tabBtn.active : s.tabBtn.idle) }}
          onClick={() => setActiveTab('regular')}
        >
          Regular ({filteredRegular.length})
        </button>
        <button
          style={{ ...s.tabBtn.base, ...(activeTab === 'hourly' ? s.tabBtn.active : s.tabBtn.idle) }}
          onClick={() => setActiveTab('hourly')}
        >
          Hourly ({filteredHourly.length})
        </button>

        {/* Search */}
        <input
          style={s.searchBox}
          placeholder="Search by ID, location, vehicle…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />

        {/* Refresh button */}
        <button style={s.refreshBtn} onClick={refreshAll} title={`Auto-refreshes in ${nextRefreshIn}s`}>
          <span style={{ display: 'inline-block', animation: isLoading ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
          {isLoading ? 'Loading…' : `Refresh (${nextRefreshIn}s)`}
        </button>
      </div>

      {/* ── Info bar ── */}
      {activeData.length > 0 && (
        <div style={s.info}>
          ℹ️ Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, activeData.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, activeData.length)} of {activeData.length}{' '}
          {activeTab === 'hourly' ? 'hourly unassigned' : 'unlocked'} bookings
          {lastUpdated && activeTab === 'regular' && (
            <span style={{ marginLeft: 10, color: '#9ca3af' }}>· Last updated: {fmtLastUpdated(lastUpdated)}</span>
          )}
          <span
            style={{ marginLeft: 10, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.72rem' }}
            onClick={navToPage}
          >
            View full page ↗
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 6, fontSize: '0.8rem', marginBottom: 8 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && regularRows.length === 0 && hourlyRows.length === 0 && (
        <div style={s.loading}><Spinner /> Loading…</div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !error && activeData.length === 0 && (
        <div style={s.empty}>
          <span style={{ fontSize: '2rem' }}>✅</span>
          <span style={{ fontWeight: 600 }}>
            {activeTab === 'regular' ? 'No Unlocked Bookings' : 'No Hourly Unassigned Bookings'}
          </span>
          <span>
            {searchTerm
              ? 'No results match your search.'
              : activeTab === 'regular'
                ? 'All bookings have been locked or assigned.'
                : 'All near-term hourly bookings are assigned.'}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      {!isLoading && pagedData.length > 0 && (
        <>
          {activeTab === 'regular'
            ? <RegularTable rows={pagedData} opsAgentTriggers={opsAgentTriggers} onRowClick={navToPage} />
            : <HourlyTable  rows={pagedData} onRowClick={navToPage} />
          }

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={s.pagination}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ ...s.pageBtn, opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Previous
              </button>
              <span style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ ...s.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Footer ── */}
      {activeData.length > 0 && (
        <div style={s.footer}>
          {activeData.length} record{activeData.length !== 1 ? 's' : ''} total ·{' '}
          <span style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }} onClick={navToPage}>
            Open full Unlocked Bookings page ↗
          </span>
        </div>
      )}
    </div>
  );
};

export default UnlockedBookingsPanel;
