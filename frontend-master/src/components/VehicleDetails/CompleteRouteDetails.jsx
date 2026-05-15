import React, { useState, useEffect } from 'react';
import DateSection from './DateSection';
import './styles/CompleteRouteDetails.css';
import config from '../../config';
import { useDateFilter } from '../../contexts/DateFilterContext';

const CompleteRouteDetails = ({ vehicleId }) => {
  const [bookingsData, setBookingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dateRange } = useDateFilter();
  
  // Fetch bookings
  useEffect(() => {
    if (!vehicleId) return;
    
    fetchBookingsTimeline();
    
    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(fetchBookingsTimeline, 30000);
    
    return () => clearInterval(interval);
  }, [vehicleId, dateRange]);
  
  const fetchBookingsTimeline = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      
      // Build URL with date filter if available
      let apiUrl = `${config.dispatchApiBase}/vehicles/${vehicleId}/bookings-timeline`;
      if (dateRange.startDate && dateRange.endDate) {
        apiUrl += `?from_date=${dateRange.startDate}&to_date=${dateRange.endDate}`;
      }
      
      const response = await fetch(
        apiUrl,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bookings: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setBookingsData(data);
      } else {
        throw new Error(data.error || 'Failed to fetch bookings');
      }
    } catch (err) {
      console.error('Error fetching bookings timeline:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="complete-route-details">
        <h3>Complete Route Details</h3>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="complete-route-details">
        <h3>Complete Route Details</h3>
        <div className="error-state">
          <p>⚠️ {error}</p>
          <button onClick={fetchBookingsTimeline} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!bookingsData || bookingsData.total_bookings === 0) {
    return (
      <div className="complete-route-details">
        <h3>Complete Route Details</h3>
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h4>No Bookings Found</h4>
          <p>This vehicle has no bookings in the selected period</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="complete-route-details">
      <h3>Complete Route Details</h3>
      
      <div className="bookings-summary">
        <span>Total Bookings: <strong>{bookingsData.total_bookings}</strong></span>
        {bookingsData.vehicle_number && (
          <span>Vehicle: <strong>{bookingsData.vehicle_number}</strong></span>
        )}
      </div>
      
      <div className="bookings-timeline">
        {bookingsData.bookings_by_date.map(dateGroup => (
          <DateSection 
            key={dateGroup.date}
            date={dateGroup.date}
            displayLabel={dateGroup.display_label}
            bookings={dateGroup.bookings}
          />
        ))}
      </div>
    </div>
  );
};

export default CompleteRouteDetails;
