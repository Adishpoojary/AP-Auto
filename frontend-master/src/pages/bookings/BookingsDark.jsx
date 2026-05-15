import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, MapPin, ArrowRight, Clock, RefreshCw } from 'lucide-react';
import config from '../../config';

const FILTERS = ['all', 'pending', 'offered', 'accepted', 'ride_started', 'ride_completed', 'cancelled'];
const FILTER_LABELS = { all: 'All', pending: 'Pending', offered: 'Offered', accepted: 'Accepted',
  ride_started: 'In progress', ride_completed: 'Completed', cancelled: 'Cancelled' };
const BADGE_MAP = {
  pending: 'ap-pill-amber', offered: 'ap-pill-blue', accepted: 'ap-pill-green',
  driver_arrived: 'ap-pill-cyan', ride_started: 'ap-pill-purple',
  ride_completed: 'ap-pill-green', cancelled: 'ap-pill-red', no_driver_found: 'ap-pill-gray',
};
const STATUS_LABEL = {
  pending: 'Pending', offered: 'Offered', accepted: 'Accepted',
  driver_arrived: 'Arrived', ride_started: 'In progress', ride_completed: 'Completed',
  cancelled: 'Cancelled', no_driver_found: 'No driver',
};
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '';

const BookingsDark = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRides = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.opsApiBase}/rides/ops/overview`);
      const data = await res.json();
      if (data.success) setRides(data.data.recent_rides || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRides(); const iv = setInterval(fetchRides, 30000); return () => clearInterval(iv); }, [fetchRides]);

  const filtered = rides.filter(r => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchSearch = !searchTerm ||
      (r.booking_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.pickup_address || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <>
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <div className="ap-topbar-title">Active rides</div>
          <span className="ap-card-badge" style={{ marginLeft: 8 }}>{rides.length} total</span>
        </div>
        <div className="ap-topbar-right">
          <button className="ap-btn ap-btn-ghost" onClick={fetchRides} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="ap-btn ap-btn-primary">
            <Plus size={16} /> New booking
          </button>
        </div>
      </div>

      <div className="ap-content">
        {/* Filter + Search */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ap-filter-tabs">
            {FILTERS.map(f => (
              <button key={f} className={`ap-filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}>
                {FILTER_LABELS[f] || f}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="ap-search" style={{ minWidth: 260 }}>
            <Search size={16} />
            <input placeholder="Search rides..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <X size={14} style={{ cursor: 'pointer', color: 'var(--ap-text-muted)' }}
              onClick={() => setSearchTerm('')} />}
          </div>
        </div>

        {/* Rides Grid */}
        {loading && rides.length === 0 ? (
          <div className="ap-card"><div className="ap-empty"><p>Loading rides...</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="ap-card">
            <div className="ap-empty">
              <div className="ap-empty-icon">🛺</div>
              <h3>No rides found</h3>
              <p>{searchTerm ? `No results for "${searchTerm}"` : 'No rides match the current filter'}</p>
            </div>
          </div>
        ) : (
          <div className="ap-ride-grid">
            {filtered.map(r => (
              <div className="ap-ride-card" key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ap-accent)' }}>{r.booking_code}</span>
                    <span className={`ap-pill ${BADGE_MAP[r.status] || 'ap-pill-gray'}`} style={{ marginLeft: 8 }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ap-text)' }}>
                    ₹{(r.total_customer_fare||0).toFixed(0)}
                  </div>
                </div>

                {/* Route */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <MapPin size={14} style={{ color: 'var(--ap-green)', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--ap-text)', lineHeight: 1.3 }}>
                      {r.pickup_address || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ArrowRight size={14} style={{ color: 'var(--ap-red)', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--ap-text-muted)', lineHeight: 1.3 }}>
                      {r.drop_address || '—'}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 10, borderTop: '1px solid var(--ap-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>
                    {r.driver_name ? `🛺 ${r.driver_name}` : '⏳ Unassigned'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ap-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {fmtTime(r.created_at)} · {fmtDate(r.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </>
  );
};

export default BookingsDark;
