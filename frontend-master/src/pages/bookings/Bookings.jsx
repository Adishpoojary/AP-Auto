import React, { useEffect, useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import config from '../../config';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { useCity } from '../../contexts/CityContext';
import s from './Bookings.module.scss';

// Equipment (hourly) vehicle class names
const EQUIPMENT_CLASS_MAP = {
  13: 'JCB - Backhoe Loader',
  14: 'Chota JCB',
  15: 'Mini Excavator',
  16: 'Excavator',
  17: 'Crane - 12 Ton',
  18: 'Crane - 14 Ton',
  19: 'Crane - 15 Ton',
};

// Standard vehicle class names
const VEHICLE_CLASS_MAP = {
  1: 'Goods Auto',
  2: 'Tata Ace',
  3: 'Pickup 1 ton',
  4: 'Pickup 7 ft',
  5: 'Pickup 8ft',
  6: 'Pickup 10ft',
  7: 'Pickup 3.5 ton',
  8: 'Pickup 12 ft',
  9: 'Pickup 14 ft',
  10: 'Pickup 18 ft',
  11: '12 ton',
  12: '16 ton',
};

const isHourlyBooking = (booking) => {
  return booking.booking_type === 'hourly' || (booking.vehicle_class_id >= 13 && booking.vehicle_class_id <= 19);
};

const getVehicleDisplayName = (booking) => {
  const classId = booking.vehicle_class_id;
  if (EQUIPMENT_CLASS_MAP[classId]) return EQUIPMENT_CLASS_MAP[classId];
  if (VEHICLE_CLASS_MAP[classId]) return VEHICLE_CLASS_MAP[classId];
  return `Class ${classId}`;
};

const formatDurationHours = (durationMinutes) => {
  if (!durationMinutes) return null;
  const hours = durationMinutes / 60;
  if (hours >= 1) return `${hours}h`;
  return `${durationMinutes}min`;
};

const CONFIG = {
  API_BASE_URL: config.customerApiBase,
  POLLING_INTERVAL: 60000, // 60s refresh keeps data current without hammering the API
  DEBOUNCE_DELAY: 400,
};

// Debounced value hook
const useDebounce = (value, delay = CONFIG.DEBOUNCE_DELAY) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

const Bookings = () => {
  const history = useHistory();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionBookingId, setActionBookingId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [modifiableBookings, setModifiableBookings] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBookings, setTotalBookings] = useState(0);
  const refreshIntervalSeconds = CONFIG.POLLING_INTERVAL / 1000;
  const [nextRefreshIn, setNextRefreshIn] = useState(refreshIntervalSeconds);
  const itemsPerPage = 20;
  const { dateRange } = useDateFilter();
  const { selectedCities } = useCity();
  
  const debouncedSearchTerm = useDebounce(searchTerm);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', itemsPerPage);
      params.append('offset', (currentPage - 1) * itemsPerPage);
      
      if (filter !== 'all') {
        if (filter === 'hourly') {
          params.append('booking_type', 'hourly');
        } else {
          params.append('state', filter);
        }
      }
      
      // Add cities filter if any cities are selected
      if (selectedCities.length > 0) {
        params.append('cities', selectedCities.join(','));
      }

      // Add search filter
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }

      // Add date filter
      if (dateRange?.startDate) {
        params.append('start_date', dateRange.startDate);
      }
      if (dateRange?.endDate) {
        params.append('end_date', dateRange.endDate);
      }
      
      const queryString = params.toString();
      const url = `${CONFIG.API_BASE_URL}/bookings${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const bookingsData = data.bookings || [];
      setBookings(bookingsData);
      const total = data.total || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));
      setTotalBookings(total);
      setNextRefreshIn(refreshIntervalSeconds);
      
      // Extract is_modifiable from each booking
      const modifiableStatus = {};
      bookingsData.forEach(booking => {
        modifiableStatus[booking.id] = booking.is_modifiable !== false; // Default to true if not specified
      });
      setModifiableBookings(modifiableStatus);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedCities, currentPage, debouncedSearchTerm, dateRange]);

  const handleModifyBooking = (booking) => {
    const normalizedBooking = {
      ...booking,
      id: booking?.id ?? booking?.booking_id ?? null,
    };

    history.push({
      pathname: '/app/customers/modify-booking',
      state: { booking: normalizedBooking, isModifying: true }
    });
  };

  const handleCancelBooking = async () => {
    if (!cancelModal) return;
    try {
      setCancellingId(cancelModal.id);
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/bookings/${cancelModal.id}/cancel`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cancelReason.trim() || null }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}`);
      }
      setCancelModal(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert(`Failed to cancel booking: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Auto-refresh bookings on an interval to keep data fresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings();
    }, CONFIG.POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // Tick down countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefreshIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh bookings on an interval to keep data fresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings();
    }, CONFIG.POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearchTerm, selectedCities, dateRange]);

  const normalizeState = (state) => {
    if (!state) return 'pending';
    return state.toLowerCase();
  };

  const formatStateDisplay = (state) => {
    const normalized = normalizeState(state);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Pagination logic
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleGeneratePaymentLink = async (booking) => {
    try {
      setActionBookingId(booking.id);
      const response = await fetch(
        `${config.paymentApiBase}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: booking.id,
            amount: booking.payment_estimate,
            customer_phone: booking.customer_phone,
            customer_name: booking.customer_name,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      }

      alert(`Payment link sent! ${data.is_existing ? '(Existing link reused)' : '(New link created)'}`);
      setPaymentModal(null);
      fetchBookings();
    } catch (err) {
      console.error('Payment link error:', err);
      alert(`Failed to generate payment link: ${err.message}`);
    } finally {
      setActionBookingId(null);
    }
  };

  const getAmountStatus = (booking) => {
    if (booking.state?.toLowerCase() === 'cancelled') return 'cancelled';
    if (booking.actual_bill !== null && booking.actual_bill !== undefined) {
      // actual_bill exists: either paid or unpaid
      return booking.payment_id ? 'paid' : 'unpaid';
    }
    // No actual_bill: it's just an estimate
    return 'estimate';
  };

  const handleAmountClick = (booking) => {
    const status = getAmountStatus(booking);
    if (status === 'cancelled' || status === 'estimate') return;

    if (status === 'paid') {
      setPaymentModal({ type: 'paid', booking });
    } else if (status === 'unpaid') {
      setPaymentModal({ type: 'unpaid', booking });
    }
  };

  const handleNewBooking = useCallback(() => {
    history.push('/app/customers/new-booking');
  }, [history]);

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.title}>
            <div className={s.titleIcon}>
              <i className="fa fa-calendar-check-o" />
            </div>
            Bookings
            <span className={s.countBadge}>{totalBookings}</span>
          </h1>
          <p className={s.subtitle}>View and manage all customer bookings</p>
        </div>
        <div className={s.headerRight}>
          <button className={s.btnNewBooking} onClick={handleNewBooking}>
            <i className="fa fa-plus" />
            New Booking
          </button>
          <button 
            className={s.refreshBtn} 
            onClick={fetchBookings}
            disabled={loading}
            title={`Auto-refreshing in ${Math.ceil(nextRefreshIn)}s`}
          >
            <i className={`fa ${loading ? 'fa-spinner fa-spin' : 'fa-refresh'}`} />
            {!loading && (
              <div className={s.refreshProgressTrack}>
                <div 
                  className={s.refreshProgressBar}
                  style={{ width: `${Math.max(0, Math.min(100, (nextRefreshIn / refreshIntervalSeconds) * 100))}%` }}
                />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Filter & Search Section */}
      <div className={s.filterSection}>
        <div className={s.filterWrapper}>
          <div className={s.filterTabs}>
            <button
              className={`${s.filterTab} ${s.all} ${filter === 'all' ? s.active : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`${s.filterTab} ${s.pending} ${filter === 'pending' ? s.active : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`${s.filterTab} ${s.modified} ${filter === 'modified' ? s.active : ''}`}
              onClick={() => setFilter('modified')}
            >
              Modified
            </button>
            <button
              className={`${s.filterTab} ${s.completed} ${filter === 'completed' ? s.active : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button
              className={`${s.filterTab} ${s.cancelled} ${filter === 'cancelled' ? s.active : ''}`}
              onClick={() => setFilter('cancelled')}
            >
              Cancelled
            </button>
            <button
              className={`${s.filterTab} ${s.hourly} ${filter === 'hourly' ? s.active : ''}`}
              onClick={() => setFilter('hourly')}
            >
              <i className="fa fa-clock-o" />
              Hourly
            </button>
          </div>

          <div className={s.searchInputGroup}>
            <span className={s.searchIcon}>
              <i className="fa fa-search" />
            </span>
            <input
              type="text"
              className={s.searchInput}
              placeholder="Search by Booking ID, Customer, or Address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className={s.clearBtn} onClick={() => setSearchTerm('')}>
                <i className="fa fa-times" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className={s.tableCard}>
        {error ? (
          <div className={s.errorState}>
            <div className={s.errorIcon}>
              <i className="fa fa-exclamation-circle" />
            </div>
            <h3>Error Loading Bookings</h3>
            <p>{error}</p>
            <button className={s.retryBtn} onClick={fetchBookings}>
              <i className="fa fa-refresh" />
              Retry
            </button>
          </div>
        ) : loading && bookings.length === 0 ? (
          <div className={s.loadingState}>
            <div className={s.spinner} />
            <p>Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>
              <i className="fa fa-calendar-times-o" />
            </div>
            <h3>No bookings found</h3>
            <p>
              {searchTerm
                ? `No bookings match "${searchTerm}"`
                : 'There are no bookings to display'}
            </p>
          </div>
        ) : (
          <div className={s.tableWrapper}>
            <table className={s.dataTable}>
              <thead>
                <tr>
                  <th><i className="fa fa-hashtag" />Booking ID</th>
                  <th><i className="fa fa-user" />Customer</th>
                  <th><i className="fa fa-map-signs" />Route</th>
                  <th><i className="fa fa-clock-o" />Timing</th>
                  <th><i className="fa fa-truck" />Vehicle</th>
                  <th><i className="fa fa-rupee" />Amount</th>
                  <th><i className="fa fa-info-circle" />State</th>
                  <th><i className="fa fa-cog" />Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className={s.refCell}>
                        <span className={s.idBadge}>{booking.id}</span>
                        {isHourlyBooking(booking) && (
                          <span className={s.hourlyBadge}>
                            <i className="fa fa-clock-o" />
                            Hourly
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={s.customerCell}>
                        <span className={s.customerName}>{booking.customer_name}</span>
                        {booking.customer_phone && (
                          <span className={s.customerPhone}>
                            <i className="fa fa-phone" />
                            {booking.customer_phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={s.routeCell}>
                      {isHourlyBooking(booking) ? (
                        <div className={s.routeItem}>
                          <div className={s.routeIconPickup}>
                            <i className="fa fa-map-pin" />
                          </div>
                          <div className={s.routeText} title={booking.pickup_address}>
                            <span className={s.jobSiteLabel}>Job Site:</span> {booking.pickup_address || 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={s.routeItem}>
                            <div className={s.routeIconPickup}>
                              <i className="fa fa-circle" />
                            </div>
                            <div className={s.routeText} title={booking.pickup_address}>
                              {booking.pickup_address || 'N/A'}
                            </div>
                          </div>
                          {booking.drop_addresses && booking.drop_addresses.map((addr, idx) => (
                            <div key={idx} className={s.routeItem}>
                              <div className={s.routeIconDrop}>
                                <i className="fa fa-map-marker" />
                              </div>
                              <div className={s.routeText} title={addr}>
                                {addr}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </td>
                    <td>
                      <div className={s.timeCell}>
                        <div className={s.mainTime}>
                          <i className="fa fa-clock-o" />
                          {formatDateTime(booking.pickup_time)}
                        </div>
                        <div className={s.subTime}>
                          Created: {formatDateTime(booking.created_at)}
                        </div>
                      </div>
                    </td>
                    <td>
                      {isHourlyBooking(booking) ? (
                        <div className={s.equipmentBadgeWrap}>
                          <span className={s.equipmentBadge}>
                            <i className="fa fa-cogs" />
                            Class {booking.vehicle_class_id}
                          </span>
                          {booking.duration > 0 && (
                            <span className={s.durationBadge}>
                              <i className="fa fa-clock-o" />
                              {formatDurationHours(booking.duration)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={s.vehicleBadge}>
                          <i className="fa fa-truck" />
                          Class {booking.vehicle_class_id}
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div 
                        className={`${s.amountCell} ${s[getAmountStatus(booking)]}`}
                        onClick={() => handleAmountClick(booking)}
                        style={{
                          cursor: ['cancelled', 'estimate'].includes(getAmountStatus(booking)) ? 'default' : 'pointer'
                        }}
                        title={getAmountStatus(booking) === 'estimate' ? 'Estimate only - waiting for final amount' : ''}
                      >
                        <div className={s.mainAmount}>
                          {getAmountStatus(booking) === 'paid' && <i className="fa fa-check-circle" style={{ marginRight: '4px' }} />}
                          {getAmountStatus(booking) === 'unpaid' && <i className="fa fa-exclamation-circle" style={{ marginRight: '4px' }} />}
                          {getAmountStatus(booking) === 'estimate' && <i className="fa fa-info-circle" style={{ marginRight: '4px' }} />}
                          ₹{booking.payment_estimate?.toFixed(2) || '0.00'}
                        </div>
                        {booking.toll_charge > 0 && (
                          <div className={s.tollInfo}>
                            (incl. ₹{Number(booking.toll_charge).toFixed(2)} toll)
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`${s.statusBadge} ${s[normalizeState(booking.state)]}`}>
                        {formatStateDisplay(booking.state)}
                      </span>
                    </td>
                    <td className={s.actionsCell}>
                      {modifiableBookings[booking.id] && 
                       normalizeState(booking.state) !== 'cancelled' && 
                       normalizeState(booking.state) !== 'completed' && (
                        <button
                          className={s.modifyBtn}
                          onClick={() => handleModifyBooking(booking)}
                          title="Modify Booking"
                        >
                          <i className="fa fa-edit" />
                          Modify
                        </button>
                      )}
                      {!modifiableBookings[booking.id] && 
                       normalizeState(booking.state) !== 'cancelled' && 
                       normalizeState(booking.state) !== 'completed' && (
                        <span className={s.notModifiable} title="Trip has already started - Booking locked">
                          <i className="fa fa-lock" />
                        </span>
                      )}
                      {modifiableBookings[booking.id] && (
                        <button
                          className={s.cancelBtn}
                          onClick={() => { setCancelModal(booking); setCancelReason(''); }}
                          title="Cancel Booking"
                        >
                          <i className="fa fa-times" />
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Controls */}
        {!loading && !error && bookings.length > 0 && (
          <div className={s.pagination}>
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className={s.pageBtn}
            >
              <i className="fa fa-chevron-left" /> Previous
            </button>
            <span className={s.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className={s.pageBtn}
            >
              Next <i className="fa fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className={s.modalOverlay} onClick={() => setPaymentModal(null)}>
          <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
            {paymentModal.type === 'paid' ? (
              <>
                <div className={s.modalHeader}>
                  <i className="fa fa-check-circle" style={{ color: '#10b981', fontSize: '24px' }} />
                  <h3>Payment Received</h3>
                </div>
                <div className={s.modalBody}>
                  <p className={s.modalLabel}>Booking ID:</p>
                  <p className={s.modalValue}>{paymentModal.booking.id}</p>
                  
                  <p className={s.modalLabel}>Amount Paid:</p>
                  <p className={s.modalValue} style={{ color: '#10b981', fontWeight: 'bold', fontSize: '20px' }}>
                    ₹{paymentModal.booking.payment_estimate?.toFixed(2)}
                  </p>
                  
                  <p className={s.modalLabel}>Payment ID:</p>
                  <p className={s.modalValue}>{paymentModal.booking.payment_id}</p>
                  
                  {paymentModal.booking.paid_at && (
                    <>
                      <p className={s.modalLabel}>Paid On:</p>
                      <p className={s.modalValue}>{formatDateTime(paymentModal.booking.paid_at)}</p>
                    </>
                  )}
                </div>
                <div className={s.modalFooter}>
                  <button className={s.modalCloseBtn} onClick={() => setPaymentModal(null)}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={s.modalHeader}>
                  <i className="fa fa-credit-card" style={{ color: '#3b82f6', fontSize: '24px' }} />
                  <h3>Send Payment Link</h3>
                </div>
                <div className={s.modalBody}>
                  <p className={s.modalLabel}>Booking ID:</p>
                  <p className={s.modalValue}>{paymentModal.booking.id}</p>
                  
                  <p className={s.modalLabel}>Customer:</p>
                  <p className={s.modalValue}>{paymentModal.booking.customer_name}</p>
                  <p className={s.modalValue} style={{ fontSize: '13px', color: '#6b7280' }}>
                    <i className="fa fa-phone" /> {paymentModal.booking.customer_phone}
                  </p>
                  
                  <p className={s.modalLabel}>Amount:</p>
                  <p className={s.modalValue} style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '20px' }}>
                    ₹{paymentModal.booking.payment_estimate?.toFixed(2)}
                  </p>
                  {paymentModal.booking.toll_charge > 0 && (
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '-8px' }}>
                      (includes ₹{Number(paymentModal.booking.toll_charge).toFixed(2)} toll charge)
                    </p>
                  )}
                  
                  {getAmountStatus(paymentModal.booking) === 'estimate' && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: '#fef3c7',
                      border: '1px solid #fcd34d',
                      borderRadius: '8px',
                      color: '#92400e',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      <i className="fa fa-info-circle" style={{ marginRight: '6px' }} />
                      This is an estimate. Payment link cannot be generated until final amount is available.
                    </div>
                  )}
                  
                  {getAmountStatus(paymentModal.booking) !== 'estimate' && (
                    <p style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
                      A payment link will be sent to the customer via WhatsApp.
                    </p>
                  )}
                </div>
                <div className={s.modalFooter}>
                  <button className={s.modalCancelBtn} onClick={() => setPaymentModal(null)}>
                    Cancel
                  </button>
                  <button 
                    className={s.modalConfirmBtn} 
                    onClick={() => handleGeneratePaymentLink(paymentModal.booking)}
                    disabled={!!actionBookingId || getAmountStatus(paymentModal.booking) === 'estimate'}
                    style={{
                      opacity: getAmountStatus(paymentModal.booking) === 'estimate' ? 0.5 : 1,
                      cursor: getAmountStatus(paymentModal.booking) === 'estimate' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {actionBookingId === paymentModal.booking.id ? (
                      <>
                        <i className="fa fa-spinner fa-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-send" />
                        Send Payment Link
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Cancel Booking Modal */}
      {cancelModal && (
        <div className={s.modalOverlay} onClick={() => setCancelModal(null)}>
          <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <i className="fa fa-exclamation-triangle" style={{ color: '#ef4444', fontSize: '24px' }} />
              <h3>Cancel Booking</h3>
            </div>
            <div className={s.modalBody}>
              <p className={s.modalLabel}>Booking ID:</p>
              <p className={s.modalValue}>{cancelModal.id}</p>

              <p className={s.modalLabel}>Customer:</p>
              <p className={s.modalValue}>{cancelModal.customer_name}</p>
              {cancelModal.customer_phone && (
                <p className={s.modalValue} style={{ fontSize: '13px', color: '#6b7280' }}>
                  <i className="fa fa-phone" /> {cancelModal.customer_phone}
                </p>
              )}

              <p className={s.modalLabel}>Reason (optional):</p>
              <textarea
                className={s.cancelReasonTextarea}
                placeholder="e.g. No driver available, Customer request, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />

              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                <i className="fa fa-info-circle" style={{ marginRight: '6px' }} />
                A cancellation message will be sent to the customer via WhatsApp.
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={s.modalCancelBtn} onClick={() => setCancelModal(null)}>
                Keep Booking
              </button>
              <button
                className={s.modalConfirmDangerBtn}
                onClick={handleCancelBooking}
                disabled={!!cancellingId}
              >
                {cancellingId === cancelModal.id ? (
                  <>
                    <i className="fa fa-spinner fa-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <i className="fa fa-times" />
                    Confirm Cancel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
