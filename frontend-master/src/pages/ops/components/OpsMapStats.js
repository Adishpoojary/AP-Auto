import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import s from '../OpsMapDashboard.module.scss'; // Reuse styles

const LegendDriverIcon = ({ color }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: '8px', flexShrink: 0 }}>
        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-8.5l1.96 2.5H17V9.5h2.5zM18 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill={color} stroke="#1a1a1a" strokeWidth="1" />
    </svg>
);

const LegendBookingIcon = ({ color }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: '8px', flexShrink: 0 }}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={color} stroke="#1a1a1a" strokeWidth="1" />
    </svg>
);

const LegendPushpinIcon = ({ color }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: '8px', flexShrink: 0 }}>
        <path d="M16 9V4.5C16 3.12 14.88 2 13.5 2h-3C9.12 2 8 3.12 8 4.5V9c-2.21 0-4 1.79-4 4s1.79 4 4 4h3v4h2v-4h3c2.21 0 4-1.79 4-4s-1.79-4-4-4z" fill={color} stroke="#1a1a1a" strokeWidth="1" />
    </svg>
);

const OpsMapStats = ({ driverCount, bookingCount, timeWindow, bookings = [], driversList = [], onDriverClick, onBookingClick, driverStatusFilter, setDriverStatusFilter }) => {
    // Which detail panel is expanded: 'drivers', 'bookings', or null
    const [expandedPanel, setExpandedPanel] = useState(null);

    // Filtering states
    const [driverSearch, setDriverSearch] = useState('');
    const [bookingSearch, setBookingSearch] = useState('');
    const [debouncedBookingSearch, setDebouncedBookingSearch] = useState('');

    // Debounce booking search (300ms delay)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedBookingSearch(bookingSearch), 300);
        return () => clearTimeout(timer);
    }, [bookingSearch]);

    // Determine time label (presets + custom Nh)
    const getTimeLabel = (w) => {
        if (w === '1h') return 'Next 1 Hour';
        if (w === '3h') return 'Next 3 Hours';
        if (w === '6h') return 'Next 6 Hours';
        if (w === 'today') return 'All Today';
        const m = (typeof w === 'string' && w) ? w.match(/^(\d+)h$/) : null;
        return m ? `Next ${m[1]} Hours` : (w || '');
    };

    // Format booking time
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Driver status mapping for colors
    const getStatusColor = (status) => {
        const colors = {
            active: 'primary',
            available: 'success',
            inactive: 'warning',
            default: 'secondary'
        };
        return colors[status] || colors.default;
    };

    // Toggle panel expansion
    const togglePanel = (panelName) => {
        setExpandedPanel(prev => prev === panelName ? null : panelName);
    };

    // Memoized filtered lists
    const filteredDrivers = React.useMemo(() => {
        return driversList.filter(driver => {
            const matchesSearch = (driver.driver_name?.toString() || "").toLowerCase().includes(driverSearch.toLowerCase()) ||
                (driver.vehicle_registration?.toString() || "").toLowerCase().includes(driverSearch.toLowerCase()) ||
                (driver.vehicle_id?.toString() || "").toLowerCase().includes(driverSearch.toLowerCase());
            
            let matchesStatus = false;
            if (driverStatusFilter === 'all') matchesStatus = true;
            else if (driverStatusFilter === 'registered') matchesStatus = driver.type === 'registered';
            else if (driverStatusFilter === 'active') matchesStatus = driver.type === 'live' && driver.driver_status === 'active';
            else if (driverStatusFilter === 'available') matchesStatus = driver.type === 'live' && driver.driver_status === 'available';
            else matchesStatus = driver.driver_status === driverStatusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [driversList, driverSearch, driverStatusFilter]);

    const filteredBookings = React.useMemo(() => {
        // Step 1: Filter by search
        const searched = bookings.filter(booking => {
            return (booking.id?.toString() || "").toLowerCase().includes(debouncedBookingSearch.toLowerCase()) ||
                (booking.pickup_address?.toString() || "").toLowerCase().includes(debouncedBookingSearch.toLowerCase()) ||
                (booking.drop_address?.toString() || "").toLowerCase().includes(debouncedBookingSearch.toLowerCase());
        });

        // Step 2: Sort by urgency (Unassigned → Delayed → Pending → Assigned → Completed)
        const urgencyOrder = { Unassigned: 0, Delayed: 1, Pending: 2, Assigned: 3, Completed: 4 };
        const getEffectiveStatus = (b) => {
            if (b.is_unassigned) return 'Unassigned';
            if (b.escalation) return 'Delayed';
            return b.state || 'Pending';
        };

        return searched.sort((a, b) => {
            const statusA = getEffectiveStatus(a);
            const statusB = getEffectiveStatus(b);
            const orderDiff = (urgencyOrder[statusA] ?? 99) - (urgencyOrder[statusB] ?? 99);
            if (orderDiff !== 0) return orderDiff;
            // Within same status, sort by pickup time (earliest/most overdue first)
            return new Date(a.pickup_time) - new Date(b.pickup_time);
        });
    }, [bookings, debouncedBookingSearch]);

    return (
        <div className="stats-container">
            {/* Total Drivers (Supply) Card */}
            <div
                className={`${s.statCard} ${expandedPanel === 'drivers' ? s.statCardActive : ''}`}
                style={{ cursor: driversList.length > 0 ? 'pointer' : 'default' }}
                onClick={() => driversList.length > 0 && togglePanel('drivers')}
            >
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h5>Total Drivers</h5>
                        <div className={s.value}>{driverCount}</div>
                        <div className={s.subtext}>Active Supply</div>
                    </div>
                    <div className="text-primary">
                        <i className="fa fa-truck fa-2x opacity-50" />
                    </div>
                </div>
                {driversList.length > 0 && (
                    <div className="mt-2">
                        {expandedPanel !== 'drivers' && (
                            <div className="text-muted small">
                                <i className="fa fa-info-circle mr-1"></i>
                                Click to see all drivers
                            </div>
                        )}
                        <div className="text-center mt-1">
                            <i className="fa fa-chevron-down" style={{
                                fontSize: '14px',
                                color: '#9CA3AF',
                                transition: 'transform 0.2s',
                                transform: expandedPanel === 'drivers' ? 'rotate(180deg)' : 'rotate(0deg)'
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Inline Driver Details Panel */}
            {expandedPanel === 'drivers' && (
                <div className={s.detailPanel}>
                    <div className={s.detailHeader}>
                        <h6 className="mb-0 font-weight-bold">Drivers ({filteredDrivers.length}/{driversList.length})</h6>
                        <div className="d-flex" style={{ gap: '6px' }}>
                            <button
                                className="btn btn-sm btn-light"
                                onClick={(e) => { e.stopPropagation(); setDriverSearch(''); setDriverStatusFilter('all'); }}
                            >
                                Clear
                            </button>
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                            >
                                <i className="fa fa-times"></i>
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="mb-2">
                        <input
                            type="text"
                            className="form-control form-control-sm mb-2"
                            placeholder="Search name or vehicle..."
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="btn-group btn-group-sm d-flex" style={{ flexWrap: 'wrap' }}>
                            <button className={`btn btn-outline-secondary ${driverStatusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setDriverStatusFilter('all') }}>All</button>
                            <button className={`btn btn-outline-success ${driverStatusFilter === 'available' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setDriverStatusFilter('available') }}>Avail</button>
                            <button className={`btn btn-outline-primary ${driverStatusFilter === 'active' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setDriverStatusFilter('active') }}>Active</button>
                            <button className={`btn btn-outline-dark ${driverStatusFilter === 'registered' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setDriverStatusFilter('registered') }}>Registered</button>
                        </div>
                    </div>

                    <div className={s.detailItemList}>
                        {filteredDrivers.length === 0 ? (
                            <div className="text-center py-3 text-muted small">No drivers match filters</div>
                        ) : (
                            filteredDrivers.map((driver, index) => (
                                <div
                                    key={driver.id || driver.driver_id || index}
                                    className={s.detailItem}
                                    role="button"
                                    tabIndex={0}
                                    style={onDriverClick ? { cursor: 'pointer' } : undefined}
                                    onClick={(e) => { e.stopPropagation(); onDriverClick?.(driver); }}
                                >
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <strong className="text-dark text-truncate mr-2" style={{ minWidth: 0 }}>
                                            {driver.driver_name || `Driver #${driver.driver_id}`}
                                            {driver.vehicle_id && <span className="ml-1" style={{ fontWeight: 800 }}>({driver.vehicle_id})</span>}
                                        </strong>
                                        <div className="d-flex align-items-center" style={{ gap: '4px' }}>
                                            {driver.driver_status === 'registered' && driver.current_step && driver.current_step !== '-' && (
                                                <span style={{
                                                    background: driver.current_step === 'completion' ? '#dcfce7' : '#fef08a',
                                                    color: driver.current_step === 'completion' ? '#166534' : '#854d0e',
                                                    padding: '3px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    textTransform: 'capitalize',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                }}>
                                                    {driver.current_step}
                                                </span>
                                            )}
                                            <span className={`badge badge-${getStatusColor(driver.driver_status)}`}>
                                                {driver.driver_status || 'offline'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="small text-muted">
                                        <div className="text-truncate" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '2px' }}>
                                            <i className="fa fa-truck mr-1" style={{ width: '12px', textAlign: 'center' }}></i>
                                            <span style={{ textTransform: 'capitalize' }}>
                                                {String(driver.vehicle_class || 'N/A').replace('class', 'Class ')}
                                            </span>
                                            {driver.vehicle_model && driver.vehicle_model !== 'N/A' ? ` - ${driver.vehicle_model}` : ''}
                                        </div>
                                        {driver.driver_status !== 'registered' && driver.vehicle_registration && driver.vehicle_registration !== 'N/A' && (
                                            <div className="text-truncate" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '2px' }}>
                                                <i className="fa fa-id-card-o mr-1" style={{ width: '12px', textAlign: 'center' }}></i> {driver.vehicle_registration}
                                            </div>
                                        )}
                                        {driver.phone && (
                                            <div className="text-truncate" style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                                <i className="fa fa-phone mr-1" style={{ width: '12px', textAlign: 'center' }}></i> {driver.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Upcoming Bookings (Demand) Card */}
            <div
                className={`${s.statCard} ${expandedPanel === 'bookings' ? s.statCardActive : ''}`}
                style={{ cursor: bookings.length > 0 ? 'pointer' : 'default' }}
                onClick={() => bookings.length > 0 && togglePanel('bookings')}
            >
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h5>Upcoming Bookings</h5>
                        <div className={s.value}>{bookingCount}</div>
                        <div className={s.subtext}>Demand ({getTimeLabel(timeWindow)})</div>
                    </div>
                    <div className="text-danger">
                        <i className="fa fa-map-marker fa-2x opacity-50" />
                    </div>
                </div>
                {bookings.length > 0 && (
                    <div className="mt-2">
                        {expandedPanel !== 'bookings' && (
                            <div className="text-muted small">
                                <i className="fa fa-info-circle mr-1"></i>
                                Click to see all bookings
                            </div>
                        )}
                        <div className="text-center mt-1">
                            <i className="fa fa-chevron-down" style={{
                                fontSize: '14px',
                                color: '#9CA3AF',
                                transition: 'transform 0.2s',
                                transform: expandedPanel === 'bookings' ? 'rotate(180deg)' : 'rotate(0deg)'
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Inline Booking Details Panel */}
            {expandedPanel === 'bookings' && (
                <div className={s.detailPanel}>
                    <div className={s.detailHeader}>
                        <h6 className="mb-0 font-weight-bold">Bookings ({filteredBookings.length}/{bookings.length})</h6>
                        <div className="d-flex" style={{ gap: '6px' }}>
                            <button
                                className="btn btn-sm btn-light"
                                onClick={(e) => { e.stopPropagation(); setBookingSearch(''); }}
                            >
                                Clear
                            </button>
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={(e) => { e.stopPropagation(); setExpandedPanel(null); }}
                            >
                                <i className="fa fa-times"></i>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mb-2">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search Booking ID or address..."
                            value={bookingSearch}
                            onChange={(e) => setBookingSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <div className={s.detailItemList}>
                        {filteredBookings.length === 0 ? (
                            <div className="text-center py-3 text-muted small">No bookings match search</div>
                        ) : (
                            filteredBookings.map((booking, index) => {
                                const now = new Date();
                                const pickupTime = new Date(booking.pickup_time);
                                const isPastPickup = booking.state === 'Pending' && pickupTime < now;
                                const isToday = pickupTime.toDateString() === now.toDateString();
                                const isOverdue = isPastPickup && isToday;
                                const isHistoricalUnassigned = isPastPickup && !isToday;
                                const displayState = isOverdue ? 'Overdue' : isHistoricalUnassigned ? 'Unassigned' : booking.state;

                                return (
                                    <div
                                        key={booking.id}
                                        className={s.detailItem}
                                        role="button"
                                        tabIndex={0}
                                        style={onBookingClick ? { cursor: 'pointer' } : undefined}
                                        onClick={(e) => { e.stopPropagation(); onBookingClick?.(booking); }}
                                    >
                                        <div className="d-flex justify-content-between align-items-start mb-1">
                                            <strong className="text-primary text-truncate mr-2" style={{ minWidth: 0 }}>
                                                #{booking.id}
                                            </strong>
                                            <div className="d-flex flex-nowrap" style={{ gap: '4px' }}>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: booking.is_unassigned || isHistoricalUnassigned
                                                            ? '#EF4444'
                                                            : booking.escalation || isOverdue
                                                                ? '#A855F7'
                                                                : displayState === 'Completed'
                                                                    ? '#10B981'
                                                                    : displayState === 'Pending'
                                                                        ? '#FFFFFF'
                                                                        : '#3B82F6',
                                                        color: (!booking.is_unassigned && !booking.escalation && displayState === 'Pending') ? '#000' : '#fff',
                                                        border: (!booking.is_unassigned && !booking.escalation && displayState === 'Pending') ? '1px solid #ccc' : 'none'
                                                    }}
                                                >
                                                    {booking.is_unassigned
                                                        ? 'Unassigned'
                                                        : booking.escalation
                                                            ? (booking.escalation.escalation_type === 'pickup_delay' ? 'Pickup Delay'
                                                                : booking.escalation.escalation_type === 'destination_delay' ? 'Drop Delay'
                                                                    : booking.escalation.escalation_type === 'completion_delay' ? 'Completion Delay'
                                                                        : 'Delayed')
                                                            : displayState}
                                                </span>
                                                <span className="badge badge-light">{booking.vehicle_type}</span>
                                            </div>
                                        </div>
                                        <div className="small text-muted mb-1">
                                            <i className="fa fa-clock-o mr-1"></i>
                                            {formatTime(booking.pickup_time)}
                                        </div>
                                        <div className="small text-muted" style={{ wordBreak: 'break-word' }}>
                                            <div className="mb-1">
                                                <i className="fa fa-arrow-circle-up text-success mr-1"></i>
                                                <strong>From:</strong> {booking.pickup_address || booking.pickup_location}
                                            </div>
                                            <div>
                                                <i className="fa fa-arrow-circle-down text-danger mr-1"></i>
                                                <strong>To:</strong> {booking.drop_address || booking.drop_location}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div >
                </div >
            )
            }

            {/* Legend */}
            <div className={s.statCard}>
                <h5 className="mb-3">Map Legend</h5>

                {/* Drivers Section */}
                <div className={s.legendSection}>
                    <h6>🚛 Drivers</h6>
                    <div className={s.legendRow}>
                        <div className={s.legendItem}>
                            <LegendDriverIcon color="#10B981" />
                            <span>Available</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendDriverIcon color="#3B82F6" />
                            <span>On Trip</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendDriverIcon color="#F59E0B" />
                            <span>Inactive</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendDriverIcon color="#9CA3AF" />
                            <span>Registered</span>
                        </div>
                    </div>
                </div>

                {/* Bookings Section */}
                <div className={s.legendSection}>
                    <h6>📦 Bookings</h6>
                    <div className={s.legendRow}>
                        <div className={s.legendItem}>
                            <LegendBookingIcon color="#EF4444" />
                            <span>Unassigned</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendBookingIcon color="#A855F7" />
                            <span>Delayed</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendBookingIcon color="#FFFFFF" />
                            <span>Pending</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendBookingIcon color="#3B82F6" />
                            <span>Assigned</span>
                        </div>
                        <div className={s.legendItem}>
                            <LegendBookingIcon color="#10B981" />
                            <span>Completed</span>
                        </div>
                    </div>
                </div>

                {/* Drop Point */}
                <div className={s.legendSection} style={{ marginBottom: 0 }}>
                    <div className={s.legendRow}>
                        <div className={s.legendItem}>
                            <LegendPushpinIcon color="#EF4444" />
                            <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Drop Point (Select booking to see)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

OpsMapStats.propTypes = {
    driverCount: PropTypes.number.isRequired,
    bookingCount: PropTypes.number.isRequired,
    timeWindow: PropTypes.string.isRequired,
    bookings: PropTypes.array,
    driversList: PropTypes.array,
    onDriverClick: PropTypes.func,
    onBookingClick: PropTypes.func,
    driverStatusFilter: PropTypes.string.isRequired,
    setDriverStatusFilter: PropTypes.func.isRequired,
};

export default OpsMapStats;
