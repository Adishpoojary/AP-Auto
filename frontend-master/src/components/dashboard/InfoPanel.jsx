import React, { useEffect, useCallback } from 'react';
import ActiveDriversPanel from './ActiveDriversPanel';
import DelayedTripsPanel from './DelayedTripsPanel';
import PanelTripsOngoing from './PanelTripsOngoing';
import BookingOverviewPanel from './BookingOverviewPanel';
import UnlockedBookingsPanel from './UnlockedBookingsPanel';
import TripsOverviewPanel from './TripsOverviewPanel';
import CustomerOverviewPanel from './CustomerOverviewPanel';
import FleetOverviewPanel from './FleetOverviewPanel';
import EscalationsOverviewPanel from './EscalationsOverviewPanel';
import RevenueDetailsPanel from './RevenueDetailsPanel';
import s from './InfoPanel.module.css';


// Labels for simple string types (legacy panels)
const STRING_TITLES = {
  trips: 'Trips Ongoing',
  drivers: 'Active Drivers',
  delayed: 'Delayed Trips',
};

// Labels for booking filter types
const BOOKING_TITLES = {
  assigned:   'Assigned Bookings',
  unassigned: 'Unassigned Bookings',
  pending:    'Pending Bookings',
  completed:  'Completed Bookings',
  cancelled:  'Cancelled Bookings',
  unlocked:   'Unlocked Bookings',
};

// Labels for trip filter types
const TRIP_TITLES = {
  ongoing:   'Ongoing Trips',
  delayed:   'Delayed Trips',
  completed: 'Completed Trips',
  cancelled: 'Cancelled Trips',
};

// Labels for customer filter types
const CUSTOMER_TITLES = {
  new:     'New Customers',
  active:  'Active Customers',
  repeat:  'Repeat Customers',
  blocked: 'Blocked Customers',
  flagged: 'Flagged Customers',
};

// Labels for fleet filter types
const FLEET_TITLES = {
  total_vehicles:     'All Vehicles',
  available_vehicles: 'Available Vehicles',
  active_drivers:     'Active Drivers',
  available_drivers:  'Available Drivers',
  busy_drivers:       'Busy Drivers',
  offline_drivers:    'Offline Drivers',
};

// Labels for escalation filter types
const ESCALATION_TITLES = {
  driver_issues:       'Driver Issues',
  customer_complaints: 'Customer Complaints',
  payment_disputes:    'Payment Disputes',
  trip_issues:         'Trip Issues',
  technical_issues:    'Technical Issues',
};

const REVENUE_TITLES = {
  total: 'Total Revenue',
  weekly: 'Weekly Revenue',
  monthly: 'Monthly Revenue',
  driver: 'Driver Earnings',
  pending: 'Pending Payments',
};


/**
 * Right-side drawer overlay. Content mounts only when open (lazy fetch per panel).
 *
 * Accepts two type shapes:
 *   - string: 'trips' | 'drivers' | 'delayed'  (legacy KPI panels)
 *   - object: { type: 'bookings', filter: string, startDate?: string, endDate?: string }
 *   - object: { type: 'trips',    filter: string, startDate?: string, endDate?: string }
 *
 * @param {{ type: string | object | null, onClose: () => void, refreshTrigger?: number | null }} props
 */
const InfoPanel = ({ type, onClose, refreshTrigger }) => {
  const isBookings  = type && typeof type === 'object' && type.type === 'bookings';
  const isTrips     = type && typeof type === 'object' && type.type === 'trips';
  const isCustomers = type && typeof type === 'object' && type.type === 'customers';
  const isFleet     = type && typeof type === 'object' && type.type === 'fleet';
  const isEscalations = type && typeof type === 'object' && type.type === 'escalations';
  const isRevenue = type && typeof type === 'object' && type.type === 'revenue';
  const isString    = type && typeof type === 'string';


  const handleEscape = useCallback(
    (e) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (!type) return undefined;
    document.addEventListener('keydown', handleEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prev;
    };
  }, [type, handleEscape]);

  if (!type) return null;

  // Resolve panel title
  let title = 'Details';
  if (isBookings)  title = BOOKING_TITLES[type.filter]  || 'Bookings';
  else if (isTrips)     title = TRIP_TITLES[type.filter]     || 'Trips';
  else if (isCustomers) title = CUSTOMER_TITLES[type.filter] || 'Customers';
  else if (isFleet)     title = FLEET_TITLES[type.filter]    || 'Fleet';
  else if (isEscalations) title = ESCALATION_TITLES[type.filter] || 'Escalations & Issues';
  else if (isRevenue) title = REVENUE_TITLES[type.metric] || 'Revenue Details';
  else if (isString)    title = STRING_TITLES[type]          || 'Details';

  const revenueDateLabel =
    isRevenue && (type.startDate || type.endDate)
      ? [type.startDate, type.endDate].filter(Boolean).join(' → ')
      : null;

  return (
    <>
      <div
        className={s.backdrop}
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <aside
        className={`${s.drawer}${isRevenue ? ` ${s.drawerRevenue}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.header}>
          <div className={s.headerLeft}>
            <h2 id="info-panel-title" className={s.title}>{title}</h2>
            {revenueDateLabel && (
              <p className={s.headerMeta}>{revenueDateLabel}</p>
            )}
          </div>
          <button
            type="button"
            className={s.closeBtn}
            onClick={onClose}
            aria-label="Close panel"
          >
            &times;
          </button>
        </header>
        <div className={s.body}>
          {/* Booking drill-down panels */}
          {isBookings && type.filter === 'unlocked' && (
            <UnlockedBookingsPanel />
          )}
          {isBookings && type.filter !== 'unlocked' && (
            <BookingOverviewPanel
              filter={type.filter}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
              useLive={type.useLive !== false}
            />
          )}

          {/* Trips drill-down panels */}
          {isTrips && (
            <TripsOverviewPanel
              filter={type.filter}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
            />
          )}

          {/* Customers drill-down panels */}
          {isCustomers && (
            <CustomerOverviewPanel
              filter={type.filter}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
            />
          )}

          {/* Fleet drill-down panels */}
          {isFleet && (
            <FleetOverviewPanel
              filter={type.filter}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
              refreshTrigger={refreshTrigger}
            />
          )}

          {/* Escalations drill-down panels */}
          {isEscalations && (
            <EscalationsOverviewPanel
              filter={type.filter}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
            />
          )}

          {/* Revenue drill-down panels */}
          {isRevenue && (
            <RevenueDetailsPanel
              metric={type.metric}
              dateRange={{ startDate: type.startDate, endDate: type.endDate }}
              refreshTrigger={refreshTrigger}
            />
          )}

          {/* Legacy KPI panels */}
          {isString && type === 'trips'   && <PanelTripsOngoing />}
          {isString && type === 'delayed' && <DelayedTripsPanel onClose={onClose} />}
          {isString && type === 'drivers' && <ActiveDriversPanel />}
        </div>

      </aside>
    </>
  );
};

export default InfoPanel;
