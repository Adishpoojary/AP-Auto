import React, { useState } from 'react';

const STATUS_CONFIG = {
  assigned: { icon: '🔵', color: 'blue', label: 'Assigned' },
  accepted: { icon: '🟢', color: 'green', label: 'Accepted' },
  en_route_pickup: { icon: '🚗', color: 'orange', label: 'On Way to Pickup' },
  at_pickup: { icon: '📍', color: 'orange', label: 'At Pickup' },
  loaded: { icon: '📦', color: 'purple', label: 'Loaded' },
  en_route_drop: { icon: '🚚', color: 'blue', label: 'On Way to Drop' },
  at_drop: { icon: '🎯', color: 'teal', label: 'At Drop Location' },
  unloaded: { icon: '✅', color: 'green', label: 'Unloaded' },
  completed: { icon: '✅', color: 'green', label: 'Completed' },
  rejected: { icon: '❌', color: 'red', label: 'Rejected' },
  timeout: { icon: '⏰', color: 'gray', label: 'Timeout' },
  cancelled: { icon: '🚫', color: 'red', label: 'Cancelled' },
  cancelled_by_customer: { icon: '🚫', color: 'red', label: 'Cancelled by Customer' },
  Cancelled: { icon: '🚫', color: 'red', label: 'Cancelled' }
};

const BookingRow = ({ booking }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.assigned;
  
  const formatTime = (datetime) => {
    if (!datetime) return 'N/A';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const formatAddress = (address) => {
    if (!address) return 'Address not available';
    return address.full_address || 
           `${address.locality || 'Unknown'}, ${address.city || 'Unknown'} - ${address.pincode || ''}`;
  };
  
  const truncateAddress = (address, maxLength = 50) => {
    if (!address) return 'Address not available';
    const fullAddr = address.locality || address.full_address || 'Address not available';
    if (fullAddr.length <= maxLength) return fullAddr;
    return fullAddr.substring(0, maxLength) + '...';
  };
  
  return (
    <div className={`booking-row ${isExpanded ? 'expanded' : ''}`}>
      <div 
        className="booking-row-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="booking-summary">
          <span className="status-icon">{status.icon}</span>
          <span className="booking-id">Booking #{booking.booking_id}</span>
          <span className="separator">|</span>
          <span className="pickup-time">{formatTime(booking.pickup_time)}</span>
        </div>
        <div className="expand-icon">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
      
      {!isExpanded && (
        <div className="booking-locations">
          <span className="pickup">
            {truncateAddress(booking.pickup_address, 45)}
          </span>
          <span className="arrow">→</span>
          <span className="drop">
            {truncateAddress(booking.drop_address, 45)}
          </span>
        </div>
      )}
      
      {isExpanded && (
        <div className="booking-details">
          {/* Pickup Details */}
          <div className="location-section">
            <div className="detail-row">
              <span className="label">📍 Pickup:</span>
              <span className="value">{formatAddress(booking.pickup_address)}</span>
            </div>
            <div className="detail-row sub-detail">
              <span className="label">Scheduled:</span>
              <span className="value">{formatTime(booking.pickup_time)}</span>
            </div>
            {booking.pickup_address?.latitude && booking.pickup_address?.longitude && (
              <div className="detail-row sub-detail">
                <span className="label">Location:</span>
                <span className="value">
                  {booking.pickup_address.latitude.toFixed(4)}, {booking.pickup_address.longitude.toFixed(4)}
                </span>
              </div>
            )}
          </div>
          
          {/* Drop Details */}
          <div className="location-section">
            <div className="detail-row">
              <span className="label">🎯 Drop:</span>
              <span className="value">{formatAddress(booking.drop_address)}</span>
            </div>
            {booking.delivery_deadline && (
              <div className="detail-row sub-detail">
                <span className="label">Deadline:</span>
                <span className="value">{formatTime(booking.delivery_deadline)}</span>
              </div>
            )}
            {booking.drop_address?.latitude && booking.drop_address?.longitude && (
              <div className="detail-row sub-detail">
                <span className="label">Location:</span>
                <span className="value">
                  {booking.drop_address.latitude.toFixed(4)}, {booking.drop_address.longitude.toFixed(4)}
                </span>
              </div>
            )}
          </div>
          
          {/* Customer & Booking Info */}
          <div className="detail-row">
            <span className="label">👤 Customer:</span>
            <span className="value">
              {booking.customer_name} | {booking.customer_phone}
              {booking.id && ` | Booking: #${booking.id}`}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="label">🚗 Vehicle:</span>
            <span className="value">
              {booking.vehicle_class} | Distance: {booking.distance_km} km
              {booking.duration_minutes && ` | Duration: ${booking.duration_minutes} mins`}
            </span>
          </div>
          
          {/* Distance Metrics - Always show, display 0 if null */}
          <div className="detail-row">
            <span className="label">📏 Distance Breakdown:</span>
            <span className="value">
              Initial Dead: {(booking.initial_dead_km ?? 0).toFixed(2)} km | 
              Active: {(booking.active_km ?? 0).toFixed(2)} km | 
              Final Dead: {(booking.final_dead_km ?? 0).toFixed(2)} km | 
              Total Dead: {(booking.total_dead_km ?? 0).toFixed(2)} km
            </span>
          </div>
          
          <div className="detail-row">
            <span className="label">💰 Estimate:</span>
            <span className="value">
              ₹{booking.payment_estimate}
              {booking.toll_charge > 0 && ` | Toll: ₹${booking.toll_charge}`}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">👨‍✈️ Driver Estimate:</span>
            <span className="value">
              ₹{booking.estimated_cost ? booking.estimated_cost : 'N/A'}
            </span>
          </div>
          
          {booking.remarks && (
            <div className="detail-row">
              <span className="label">📝 Remarks:</span>
              <span className="value remarks">{booking.remarks}</span>
            </div>
          )}
          
          {/* Trip Timeline - 4 key milestones */}
          {booking.trip_timeline && Object.values(booking.trip_timeline).some(val => val !== null) && (
            <div className="trip-timeline">
              <div className="timeline-header">TRIP TIMELINE:</div>
              
              {booking.trip_timeline.at_pickup_confirmed_at && (
                <div className="timeline-item">
                  <span className="timeline-icon">✅</span>
                  <span className="timeline-label">Reached Pickup:</span>
                  <span className="timeline-time">
                    {formatTime(booking.trip_timeline.at_pickup_confirmed_at)}
                  </span>
                </div>
              )}
              
              {booking.trip_timeline.trip_started_at && (
                <div className="timeline-item">
                  <span className="timeline-icon">🚗</span>
                  <span className="timeline-label">Trip Started:</span>
                  <span className="timeline-time">
                    {formatTime(booking.trip_timeline.trip_started_at)}
                  </span>
                </div>
              )}
              
              {booking.trip_timeline.reached_destination_at && (
                <div className="timeline-item">
                  <span className="timeline-icon">📍</span>
                  <span className="timeline-label">Reached Drop:</span>
                  <span className="timeline-time">
                    {formatTime(booking.trip_timeline.reached_destination_at)}
                  </span>
                </div>
              )}
              
              {booking.trip_timeline.trip_completed_at && (
                <div className="timeline-item">
                  <span className="timeline-icon">✅</span>
                  <span className="timeline-label">Completed:</span>
                  <span className="timeline-time">
                    {formatTime(booking.trip_timeline.trip_completed_at)}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="detail-row">
            <span className="label">Status:</span>
            <span className={`status-badge status-${booking.status}`}>
              {status.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingRow;
