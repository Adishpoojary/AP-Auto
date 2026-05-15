import React from 'react';
import BookingRow from './BookingRow';

const DateSection = ({ date, displayLabel, bookings }) => {
  return (
    <div className="date-section">
      <div className="date-header">
        📅 {displayLabel}
      </div>
      <div className="bookings-list">
        {bookings.map(booking => (
          <BookingRow key={booking.booking_id} booking={booking} />
        ))}
      </div>
    </div>
  );
};

export default DateSection;
