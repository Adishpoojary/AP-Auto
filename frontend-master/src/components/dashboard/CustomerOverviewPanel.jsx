import React, { useEffect, useState, useRef } from 'react';
import { Table, Badge } from 'reactstrap';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import config from '../../config';
import PanelPagination from './PanelPagination';

// ── Filter display config ─────────────────────────────────────────────────────
const FILTER_LABELS = {
  new:     'New Customers',
  active:  'Active Customers',
  repeat:  'Repeat Customers',
  blocked: 'Blocked Customers',
  flagged: 'Flagged Customers',
};

const FILTER_ACCENT = {
  new:     '#10b981',
  active:  '#3b82f6',
  repeat:  '#06b6d4',
  blocked: '#ef4444',
  flagged: '#f59e0b',
};

// ── Shared styles ─────────────────────────────────────────────────────────────
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

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const isBlocked = status === 'blocked';
  return (
    <Badge color={isBlocked ? 'danger' : 'success'} pill>
      {isBlocked ? 'Blocked' : 'Active'}
    </Badge>
  );
};

// ── Customer table ────────────────────────────────────────────────────────────
const CustomerTable = ({ rows, onRowClick }) => (
  <div style={styles.tableWrap}>
    <Table hover responsive size="sm" className="mb-0" style={{ fontSize: '0.8rem' }}>
      <thead>
        <tr>
          <th className="border-top-0 border-bottom-0 text-muted">Customer Name</th>
          <th className="border-top-0 border-bottom-0 text-muted">Phone</th>
          <th className="border-top-0 border-bottom-0 text-muted text-center">Total Bookings</th>
          <th className="border-top-0 border-bottom-0 text-muted">Last Booking</th>
          <th className="border-top-0 border-bottom-0 text-muted">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.customer_id ?? i}
            style={{ cursor: 'pointer' }}
            onClick={() => onRowClick(row)}
            title="Click to view Customer"
          >
            <td className="align-middle">
              <div className="font-weight-bold">{row.name}</div>
              <div className="small text-muted">ID #{row.customer_id || '—'}</div>
            </td>
            <td className="align-middle">
              <span style={{ fontFamily: 'monospace' }}>{row.phone}</span>
            </td>
            <td className="align-middle text-center">
              {row.total_bookings > 0
                ? <Badge color="primary" pill>{row.total_bookings}</Badge>
                : <span className="text-muted">0</span>
              }
            </td>
            <td className="align-middle small text-muted">
              {row.last_booking_date}
            </td>
            <td className="align-middle">
              <StatusBadge status={row.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const CustomerOverviewPanel = ({ filter, dateRange }) => {
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

    const params = new URLSearchParams({ type: 'customers', filter, page: String(page), limit: String(PAGE_LIMIT) });
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
        setError('Failed to load customer details. Please try again.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filter, dateRange?.startDate, dateRange?.endDate, page]);

  const accentColor = FILTER_ACCENT[filter] || '#6b7280';
  const pagerVisible = totalCount > PAGE_LIMIT && totalPages > 1;

  return (
    <div style={styles.wrapper}>
      {/* ── Sub-header ── */}
      <div style={styles.subtitle}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
        <span>{FILTER_LABELS[filter] || 'Customers'}</span>
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
          <span style={{ fontSize: '1.5rem' }}>👤</span>
          No customers found for this period.
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && rows.length > 0 && (
        <>
          <CustomerTable 
            rows={rows} 
            onRowClick={() => history.push('/app/customers')} 
          />
          <div style={styles.footer} className="text-muted">
            {!pagerVisible && (
              <>
                Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
                {' · '}
              </>
            )}
            <span
              style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => history.push('/app/customers')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') history.push('/app/customers');
              }}
            >
              View all Customers ↗
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

export default CustomerOverviewPanel;
