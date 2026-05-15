import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LiveMap from '../../components/dashboard/LiveMap';
import config from '../../config';
import './OpsDashboard.css';

const BADGE_MAP = {
  pending:         { cls: 'ops-badge-pending',   label: 'Pending' },
  offered:         { cls: 'ops-badge-offered',   label: 'Offered' },
  accepted:        { cls: 'ops-badge-accepted',  label: 'Accepted' },
  driver_arrived:  { cls: 'ops-badge-arrived',   label: 'Arrived' },
  ride_started:    { cls: 'ops-badge-started',   label: 'In Progress' },
  ride_completed:  { cls: 'ops-badge-completed', label: 'Completed' },
  cancelled:       { cls: 'ops-badge-cancelled', label: 'Cancelled' },
  no_driver_found: { cls: 'ops-badge-nodriver',  label: 'No Driver' },
};

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#06b6d4'];
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';

const OperationsDashboard = () => {
  const [kpis, setKpis] = useState({ online_drivers:0, total_drivers:0, pending_rides:0, active_rides:0, completed_today:0, revenue_today:0 });
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [now, setNow] = useState(new Date());
  const [chartTab, setChartTab] = useState('area');

  // Live clock
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Poll data
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

  // Chart mock data (simulated hourly)
  const hourlyData = useMemo(() => {
    const hrs = [];
    for (let i = 6; i <= 22; i++) {
      hrs.push({ hour: `${i}:00`, rides: Math.floor(Math.random()*8)+1, revenue: Math.floor(Math.random()*400)+50 });
    }
    return hrs;
  }, []);

  // Status donut
  const statusCounts = useMemo(() => {
    const m = { completed:0, active:0, cancelled:0 };
    rides.forEach(r => {
      if (r.status === 'ride_completed') m.completed++;
      else if (['offered','accepted','driver_arrived','ride_started'].includes(r.status)) m.active++;
      else m.cancelled++;
    });
    return [
      { name: 'Completed', value: m.completed, color: '#10b981' },
      { name: 'Active', value: m.active, color: '#3b82f6' },
      { name: 'Cancelled', value: m.cancelled, color: '#ef4444' },
    ].filter(x => x.value > 0);
  }, [rides]);

  const kpiCards = [
    { title:'Online Drivers', value: kpis.online_drivers, sub:`of ${kpis.total_drivers} total`, icon:'🛺', gradient:'linear-gradient(135deg,#10b981,#059669)' },
    { title:'Pending Queue', value: kpis.pending_rides, sub:'awaiting assignment', icon:'⏳', gradient:'linear-gradient(135deg,#f97316,#ea580c)' },
    { title:'Active Rides', value: kpis.active_rides, sub:'in progress now', icon:'🔄', gradient:'linear-gradient(135deg,#3b82f6,#2563eb)' },
    { title:'Completed Today', value: kpis.completed_today, sub:'trips finished', icon:'✅', gradient:'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
    { title:'Revenue Today', value:`₹${kpis.revenue_today.toFixed(0)}`, sub:'total collected', icon:'💰', gradient:'linear-gradient(135deg,#f59e0b,#d97706)' },
  ];

  return (
    <div className="ops-root">
      {/* Header */}
      <div className="ops-header">
        <div className="ops-header-left">
          <div className="ops-header-logo">🛺</div>
          <div>
            <div className="ops-header-title">AP Autos Command Center</div>
            <div className="ops-header-sub">Udupi • Manipal • Real-time Operations</div>
          </div>
        </div>
        <div className="ops-header-right">
          <span className="ops-clock">{now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          <div style={{width:1,height:20,background:'var(--ops-divider)'}} />
          <div className="ops-status-badge"><span className="ops-pulse" /> System Online</div>
        </div>
      </div>

      <div className="ops-body">
        {/* KPI Cards */}
        <div className="ops-kpi-grid">
          {kpiCards.map((k,i) => (
            <div className="ops-kpi" key={i}>
              <div className="ops-kpi-bar" style={{background:k.gradient}} />
              <div className="ops-kpi-label">{k.title}</div>
              <div className="ops-kpi-row">
                <div className="ops-kpi-value">{k.value}</div>
                <div className="ops-kpi-icon">{k.icon}</div>
              </div>
              <div className="ops-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid: Map + Feed */}
        <div className="ops-main-grid">
          {/* Live Map */}
          <div className="ops-card">
            <div className="ops-card-head">
              <span className="ops-card-title">📍 Live Fleet Map</span>
              <span className="ops-card-badge">Auto-refresh 3s</span>
            </div>
            <div className="ops-card-body" style={{padding:12}}>
              <div className="ops-map-wrap">
                <React.Suspense fallback={<div className="ops-empty">Loading Map...</div>}>
                  <LiveMap />
                </React.Suspense>
              </div>
            </div>
          </div>

          {/* Live Ride Feed */}
          <div className="ops-card">
            <div className="ops-card-head">
              <span className="ops-card-title">📋 Live Ride Feed</span>
              <span className="ops-card-badge">{rides.length} rides</span>
            </div>
            <div className="ops-card-body ops-feed">
              {rides.length === 0 ? (
                <div className="ops-empty"><div className="ops-empty-icon">🛺</div><p>No rides yet. Book one from the Customer App!</p></div>
              ) : rides.slice(0,20).map((r,i) => {
                const b = BADGE_MAP[r.status] || { cls:'', label: r.status };
                return (
                  <div className="ops-feed-item" key={r.id}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span className="ops-feed-code">{r.booking_code}</span>
                        <span className={`ops-badge ${b.cls}`}>{b.label}</span>
                      </div>
                      <div className="ops-feed-route">{r.pickup_address} → {r.drop_address}</div>
                      <div className="ops-feed-meta">{r.driver_name ? `🛺 ${r.driver_name}` : '⏳ Unassigned'} • {fmtTime(r.created_at)}</div>
                    </div>
                    <div className="ops-feed-fare">₹{r.total_customer_fare.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Second Row: Charts + Driver Table */}
        <div className="ops-main-grid">
          {/* Charts */}
          <div className="ops-card">
            <div className="ops-card-head">
              <span className="ops-card-title">📊 Analytics</span>
              <div className="ops-chart-tabs">
                {['area','bar','donut'].map(t => (
                  <button key={t} className={`ops-chart-tab ${chartTab===t?'active':''}`} onClick={() => setChartTab(t)}>
                    {t === 'area' ? '📈 Rides' : t === 'bar' ? '💰 Revenue' : '🍩 Status'}
                  </button>
                ))}
              </div>
            </div>
            <div className="ops-card-body">
              <div className="ops-chart-wrap">
                {chartTab === 'area' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData}>
                      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="hour" tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background:'#1e293b',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#f1f5f9',fontSize:12}} />
                      <Area type="monotone" dataKey="rides" stroke="#3b82f6" strokeWidth={2} fill="url(#gArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {chartTab === 'bar' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <XAxis dataKey="hour" tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:'#475569',fontSize:11}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background:'#1e293b',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#f1f5f9',fontSize:12}} />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartTab === 'donut' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusCounts.length?statusCounts:[{name:'No Data',value:1,color:'#334155'}]} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,value})=>`${name}: ${value}`} >
                        {(statusCounts.length?statusCounts:[{color:'#334155'}]).map((e,i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{background:'#1e293b',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#f1f5f9',fontSize:12}} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Driver Table */}
          <div className="ops-card">
            <div className="ops-card-head">
              <span className="ops-card-title">👥 Driver Fleet</span>
              <span className="ops-card-badge">{drivers.length} drivers</span>
            </div>
            <div className="ops-card-body" style={{padding:0,maxHeight:320,overflowY:'auto'}}>
              <table className="ops-table">
                <thead><tr><th>Driver</th><th>Status</th><th>Rating</th><th>Rides</th></tr></thead>
                <tbody>
                  {drivers.slice(0,15).map((d,i) => (
                    <tr key={d.driver_id}>
                      <td style={{display:'flex',alignItems:'center'}}>
                        <span className="ops-avatar" style={{background:AVATAR_COLORS[i%AVATAR_COLORS.length]}}>{(d.name||'D')[0]}</span>
                        <div><div className="ops-driver-name">{d.name}</div><div className="ops-driver-phone">{d.vehicle_registration}</div></div>
                      </td>
                      <td><span className={`ops-online-dot ${d.is_online?'on':'off'}`} />{d.is_online?'Online':'Offline'}</td>
                      <td>⭐ {d.rating?.toFixed(1)}</td>
                      <td style={{fontWeight:700}}>{d.total_rides}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drivers.length === 0 && <div className="ops-empty"><p>No drivers registered yet.</p></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;
