import React, { useState, useEffect } from 'react';
import LiveMap from '../../components/dashboard/LiveMap';
import config from '../../config';

const FleetMapDark = () => {
  const [driverCount, setDriverCount] = useState(0);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${config.opsApiBase}/drivers/`);
        const data = await res.json();
        if (data.drivers) setDriverCount(data.drivers.filter(d => d.is_online).length);
      } catch (e) { console.error(e); }
    };
    fetch_();
    const iv = setInterval(fetch_, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <div className="ap-topbar-title">Fleet map</div>
        </div>
        <div className="ap-topbar-right">
          <div className="ap-status-pill">{driverCount} drivers online</div>
        </div>
      </div>

      <div style={{ position: 'relative', height: 'calc(100vh - 57px)' }}>
        {/* Full-width map */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <LiveMap />
        </div>

        {/* Floating legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 24,
          background: 'var(--ap-surface)', border: '1px solid var(--ap-border)',
          borderRadius: 'var(--ap-radius)', padding: '16px 20px',
          minWidth: 180, zIndex: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ap-text)', marginBottom: 12 }}>Legend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ap-green)' }} />
              <span style={{ color: 'var(--ap-text-muted)' }}>Online driver</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ap-accent)' }} />
              <span style={{ color: 'var(--ap-text-muted)' }}>Popular stop</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ap-blue)' }} />
              <span style={{ color: 'var(--ap-text-muted)' }}>Landmark</span>
            </div>
          </div>
        </div>

        {/* Driver count overlay */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'var(--ap-surface)', border: '1px solid var(--ap-border)',
          borderRadius: 'var(--ap-radius-sm)', padding: '10px 16px',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ap-accent)' }}>{driverCount}</span>
          <span style={{ fontSize: 11, color: 'var(--ap-text-muted)', lineHeight: 1.2 }}>drivers<br/>online</span>
        </div>
      </div>
    </>
  );
};

export default FleetMapDark;
