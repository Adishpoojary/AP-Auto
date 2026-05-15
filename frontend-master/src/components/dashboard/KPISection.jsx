import React from 'react';
import KPICard from './KPICard';
import SkeletonCard from './SkeletonCard';

const KPISection = ({ loading, data, onOpenPanel, isTodaySelected, dateRange }) => {
  if (loading || !data) {
    return (
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: '1 1 200px' }}><SkeletonCard height="110px" /></div>
        <div style={{ flex: '1 1 200px' }}><SkeletonCard height="110px" /></div>
        <div style={{ flex: '1 1 200px' }}><SkeletonCard height="110px" /></div>
        <div style={{ flex: '1 1 200px' }}><SkeletonCard height="110px" /></div>
        <div style={{ flex: '1 1 200px' }}><SkeletonCard height="110px" /></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
      <div style={{ flex: '1 1 200px' }}>
        <KPICard
          title={isTodaySelected ? 'Bookings Today' : 'Total Bookings'}
          value={data.bookings_today || 0}
          icon="fa-calendar-check-o"
          color="success"
          linkDateFilter
        />
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <KPICard
          title="Trips Ongoing"
          value={data.ongoing_trips || 0}
          icon="fa-truck"
          color="primary"
          onIconClick={onOpenPanel ? () => onOpenPanel({ type: 'trips', filter: 'ongoing', startDate: dateRange?.startDate, endDate: dateRange?.endDate }) : undefined}
        />
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <KPICard
          title="Active Drivers"
          value={data.active_drivers || 0}
          icon="fa-user-circle"
          color="info"
          onIconClick={onOpenPanel ? () => onOpenPanel({ type: 'fleet', filter: 'active_drivers', startDate: dateRange?.startDate, endDate: dateRange?.endDate }) : undefined}
        />
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <KPICard
          title="Delayed Trips"
          value={data.delayed_trips || 0}
          icon="fa-exclamation-triangle"
          color="warning"
          onIconClick={onOpenPanel ? () => onOpenPanel({ type: 'trips', filter: 'delayed', startDate: dateRange?.startDate, endDate: dateRange?.endDate }) : undefined}
        />
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <KPICard
          title={isTodaySelected ? 'Revenue Today' : 'Total Revenue'}
          value={`₹${(data.revenue_today || 0).toLocaleString('en-IN')}`}
          icon="fa-rupee"
          color="success"
        />
      </div>
    </div>
  );
};

export default KPISection;
