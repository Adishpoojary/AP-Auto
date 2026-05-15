import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LiveMap from '../../components/dashboard/LiveMap';
import config from '../../config';

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#06b6d4'];
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

const DashboardDark = () => {
  const [kpis, setKpis] = useState({ online_drivers:0, total_drivers:0, pending_rides:0, active_rides:0, completed_today:0, revenue_today:0 });
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [opsRes, drvRes] = await Promise.all([
          fetch(`${config.opsApiBase}/rides/ops/overview`),
          fetch(`${config.opsApiBase}/drivers/`),
        ]);
        const opsData = await opsRes.json();
        const drvData = await drvRes.json();
        if (opsData.success) { setKpis(opsData.data.kpis); setRides(opsData.data.recent_rides); }
        if (drvData.drivers) setDrivers(drvData.drivers);
      } catch(e) { console.error('Ops poll error', e); }
    };
    fetchAll();
    const iv = setInterval(fetchAll, 5000);
    return () => clearInterval(iv);
  }, []);

  const metrics = [
    { label: 'Online drivers', value: kpis.online_drivers, sub: `of ${kpis.total_drivers} total`, accent: 'green', icon: '🛺' },
    { label: 'Pending queue', value: kpis.pending_rides, sub: 'awaiting assignment', accent: 'amber', icon: '⏳' },
    { label: 'Active rides', value: kpis.active_rides, sub: 'in progress now', accent: 'blue', icon: '🔄' },
    { label: 'Completed today', value: kpis.completed_today, sub: 'trips finished', accent: 'purple', icon: '✅' },
    { label: 'Revenue today', value: `₹${(kpis.revenue_today||0).toFixed(0)}`, sub: 'total collected', accent: 'pink', icon: '💰' },
  ];

  return (
    <>
      {/* Top Bar */}
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <div className="ap-topbar-title">Command center</div>
        </div>
        <div className="ap-topbar-right">
          <span className="ap-clock">{now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          <div className="ap-status-pill"><span className="ap-pulse" /> System online</div>
        </div>
      </div>

      <div className="ap-content">
        {/* Metric Cards */}
        <div className="ap-metrics">
          {metrics.map((m, i) => (
            <div className={`ap-metric ${m.accent}`} key={i}>
              <div className="ap-metric-icon">{m.icon}</div>
              <div className="ap-metric-label">{m.label}</div>
              <div className="ap-metric-value">{m.value}</div>
              <div className="ap-metric-sub">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Map + Feed */}
        <div className="ap-grid-2">
          <div className="ap-card">
            <div className="ap-card-header">
              <div className="ap-card-title">📍 Live fleet map</div>
              <span className="ap-card-badge">Auto-refresh 3s</span>
            </div>
            <div className="ap-card-body" style={{ padding: 12 }}>
              <div className="ap-map-wrap">
                <React.Suspense fallback={
                  <div style={{
                    width: '100%', height: '100%', minHeight: 350,
                    background: '#1a1f2e', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, border: '3px solid rgba(245,158,11,0.3)',
                      borderTopColor: '#f59e0b', borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <span style={{ color: '#64748b', fontSize: 13 }}>Loading map...</span>
                  </div>
                }>
                  <LiveMap />
                </React.Suspense>
              </div>
            </div>
          </div>

          <div className="ap-card">
            <div className="ap-card-header">
              <div className="ap-card-title">📋 Live feed</div>
              <span className="ap-card-badge">{drivers.length} drivers</span>
            </div>
            <div className="ap-card-body ap-feed" style={{ padding: 0 }}>
              {drivers.length === 0 ? (
                <div className="ap-empty">
                  <div className="ap-empty-icon">🛺</div>
                  <h3>No drivers yet</h3>
                  <p>Drivers will appear here when online</p>
                </div>
              ) : (
                drivers.slice(0, 15).map((d, i) => (
                  <div className="ap-feed-item" key={d.driver_id}>
                    <div className="ap-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {(d.name || 'D')[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ap-text)' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ap-text-dim)' }}>{d.vehicle_registration || '—'}</div>
                    </div>
                    <span className={d.is_online ? 'ap-pill ap-pill-green' : 'ap-pill ap-pill-gray'}>
                      {d.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Rides */}
        <div className="ap-card" style={{ marginBottom: 24 }}>
          <div className="ap-card-header">
            <div className="ap-card-title">🕐 Recent rides</div>
            <span className="ap-card-badge">{rides.length} today</span>
          </div>
          <div className="ap-card-body" style={{ padding: 0, maxHeight: 340, overflowY: 'auto' }}>
            {rides.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-empty-icon">📋</div>
                <h3>No rides yet</h3>
                <p>Book a ride from the customer app to see it here</p>
              </div>
            ) : (
              <table className="ap-table">
                <thead><tr><th>Code</th><th>Route</th><th>Driver</th><th>Fare</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {rides.slice(0, 20).map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: 'var(--ap-accent)' }}>{r.booking_code}</td>
                      <td>
                        <div style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.pickup_address}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ap-text-dim)' }}>→ {r.drop_address}</div>
                      </td>
                      <td>{r.driver_name || <span style={{ color: 'var(--ap-text-dim)' }}>Unassigned</span>}</td>
                      <td style={{ fontWeight: 600 }}>₹{(r.total_customer_fare||0).toFixed(0)}</td>
                      <td><span className={`ap-pill ${BADGE_MAP[r.status] || 'ap-pill-gray'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                      <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{fmtTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardDark;
