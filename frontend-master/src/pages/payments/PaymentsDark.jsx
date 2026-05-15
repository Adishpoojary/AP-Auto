import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, X } from 'lucide-react';
import config from '../../config';

const PaymentsDark = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.opsApiBase}/rides/ops/overview`);
      const data = await res.json();
      if (data.success) setRides(data.data.recent_rides || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completedRides = rides.filter(r => r.status === 'ride_completed');
  const totalRevenue = completedRides.reduce((s, r) => s + (r.total_customer_fare || 0), 0);
  const pendingPayments = rides.filter(r => ['accepted', 'ride_started', 'offered'].includes(r.status));

  const filtered = rides.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (r.booking_code || '').toLowerCase().includes(term) ||
      (r.customer_name || '').toLowerCase().includes(term) ||
      (r.driver_name || '').toLowerCase().includes(term);
  });

  const summaryCards = [
    { label: 'Total revenue', value: `₹${totalRevenue.toFixed(0)}`, accent: 'green', icon: '💰' },
    { label: 'Completed rides', value: completedRides.length, accent: 'purple', icon: '✅' },
    { label: 'Pending payments', value: pendingPayments.length, accent: 'amber', icon: '⏳' },
    { label: 'Average fare', value: `₹${completedRides.length ? (totalRevenue / completedRides.length).toFixed(0) : 0}`, accent: 'blue', icon: '📊' },
  ];

  const fmtTime = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const statusPill = (status) => {
    if (status === 'ride_completed') return { cls: 'ap-pill-green', label: 'Paid' };
    if (status === 'cancelled') return { cls: 'ap-pill-red', label: 'Failed' };
    return { cls: 'ap-pill-amber', label: 'Pending' };
  };

  return (
    <>
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <div className="ap-topbar-title">Payments</div>
        </div>
        <div className="ap-topbar-right">
          <button className="ap-btn ap-btn-ghost">
            <Calendar size={14} /> Date range
          </button>
        </div>
      </div>

      <div className="ap-content">
        {/* Revenue summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {summaryCards.map((c, i) => (
            <div className={`ap-metric ${c.accent}`} key={i}>
              <div className="ap-metric-icon">{c.icon}</div>
              <div className="ap-metric-label">{c.label}</div>
              <div className="ap-metric-value">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <div className="ap-search" style={{ maxWidth: 400 }}>
            <Search size={16} />
            <input placeholder="Search by booking ID, customer, or driver..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <X size={14} style={{ cursor: 'pointer', color: 'var(--ap-text-muted)' }}
              onClick={() => setSearchTerm('')} />}
          </div>
        </div>

        {/* Transaction table */}
        <div className="ap-card">
          <div className="ap-card-header">
            <div className="ap-card-title">💳 Transactions</div>
            <span className="ap-card-badge">{filtered.length} records</span>
          </div>
          <div className="ap-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            {loading ? (
              <div className="ap-empty"><p>Loading transactions...</p></div>
            ) : filtered.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-empty-icon">💳</div>
                <h3>No transactions</h3>
                <p>Payment records will appear here</p>
              </div>
            ) : (
              <table className="ap-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Date</th><th>Booking ID</th><th>Customer</th><th>Driver</th>
                    <th>Amount</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const pill = statusPill(r.status);
                    return (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{fmtTime(r.created_at)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--ap-accent)' }}>{r.booking_code}</td>
                        <td>{r.customer_name || '—'}</td>
                        <td>{r.driver_name || <span style={{ color: 'var(--ap-text-dim)' }}>—</span>}</td>
                        <td style={{ fontWeight: 700 }}>₹{(r.total_customer_fare||0).toFixed(0)}</td>
                        <td><span className={`ap-pill ${pill.cls}`}>{pill.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentsDark;
