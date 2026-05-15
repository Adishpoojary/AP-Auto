import React, { useState, useEffect } from 'react';
import LiveMap from '../../components/dashboard/LiveMap';

const OpsMapDashboard = () => {
    return (
        <div style={{ padding: '24px', backgroundColor: '#0d1117', minHeight: '100vh', color: '#fff' }}>
            <h2 style={{ marginBottom: '20px', color: '#FF6B6B' }}>Full Screen Auto Map</h2>
            <div style={{ height: 'calc(100vh - 120px)', borderRadius: '12px', overflow: 'hidden', border: '1px solid #30363d' }}>
                <LiveMap />
            </div>
        </div>
    );
};

export default OpsMapDashboard;
