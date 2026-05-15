import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, InputGroup } from 'reactstrap';
import PropTypes from 'prop-types';
import { useDateFilter } from '../../../contexts/DateFilterContext';

const TimeWindowFilter = ({ selectedWindow, onWindowChange, isLive, setIsLive }) => {
    const { dateRange, updateDateRange, setToday } = useDateFilter();

    // Parse current date to establish "today"
    const todayISO = new Date().toISOString().split('T')[0];
    const currentDate = dateRange.startDate || todayISO;
    const isToday = currentDate === todayISO;
    const isFuture = currentDate > todayISO;

    // Time window inputs
    const [customStart, setCustomStart] = useState(selectedWindow?.startTime || '00:00');
    const [customEnd, setCustomEnd] = useState(selectedWindow?.endTime || '23:59');

    // Date picker state
    const dateInputRef = useRef(null);

    // Default to 'today' equivalent if no specific date is set on load
    useEffect(() => {
        if (!dateRange.startDate) {
            setToday();
        }
    }, [dateRange.startDate, setToday]);

    // Handle "Today" chip click
    const handleTodayClick = () => {
        setToday();
        setCustomStart('00:00');
        setCustomEnd('23:59');
        setIsLive(true);
        // We ensure we emit the change so the parent fetches immediately
        onWindowChange({ preset: 'custom', startTime: '00:00', endTime: '23:59' });
    };

    // Handle Date Input change
    const handleDateChange = (e) => {
        const newDate = e.target.value;
        if (newDate) {
            updateDateRange(newDate, newDate);
            const newIsToday = newDate === todayISO;

            // If picking a non-today date, turn off LIVE
            if (!newIsToday) {
                setIsLive(false);
            } else {
                // If picking today, default LIVE to on
                setIsLive(true);
            }

            // Re-run the bookings fetch with the new date + current time range
            onWindowChange({ preset: 'custom', startTime: customStart, endTime: customEnd });
        }
    };

    // Handle Time API fetch via Apply button
    const handleApplyCustom = () => {
        if (customStart && customEnd) {
            onWindowChange({
                preset: 'custom',
                startTime: customStart,
                endTime: customEnd
            });
        }
    };

    // Format date for the button display
    const formatDisplayDate = (isoStr) => {
        const d = new Date(isoStr);
        if (isNaN(d)) return "Select Date";
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="d-flex align-items-center flex-nowrap" style={{ gap: '12px' }}>
            <span className="font-weight-bold text-muted text-uppercase small" style={{ letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                Show Bookings:
            </span>

            {/* Future date warning badge */}
            {isFuture && (
                <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Viewing future bookings — Live mode off
                </span>
            )}

            {/* LIVE MODE TOGGLE */}
            {isToday && (
                <div
                    className="d-flex align-items-center"
                    style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: isLive ? 'rgba(40, 167, 69, 0.1)' : 'rgba(108, 117, 125, 0.1)',
                        border: `1px solid ${isLive ? 'rgba(40, 167, 69, 0.3)' : 'rgba(108, 117, 125, 0.3)'}`
                    }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isLive ? '#28a745' : '#6c757d',
                            marginRight: '6px',
                            boxShadow: isLive ? '0 0 0 rgba(40, 167, 69, 0.4)' : 'none',
                            animation: isLive ? 'pulse 2s infinite' : 'none'
                        }}
                    />
                    <span
                        style={{
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: isLive ? '#28a745' : '#6c757d',
                            letterSpacing: '0.5px'
                        }}
                    >
                        {isLive ? 'LIVE' : 'PAUSED'}
                    </span>
                    <style>
                        {`
                        @keyframes pulse {
                            0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.4); }
                            70% { box-shadow: 0 0 0 6px rgba(40, 167, 69, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
                        }
                        `}
                    </style>
                </div>
            )}

            {/* "TODAY" QUICK CHIP */}
            <Button
                color="secondary"
                active={isToday}
                outline={!isToday}
                onClick={handleTodayClick}
                size="sm"
                style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: isToday ? 'bold' : 'normal',
                    backgroundColor: isToday ? '#343a40' : 'transparent',
                    borderColor: '#343a40',
                    color: isToday ? '#fff' : '#343a40'
                }}
            >
                Today
            </Button>

            {/* DATE PICKER BUTTON */}
            <div style={{ position: 'relative' }}>
                <Button
                    color="light"
                    size="sm"
                    onClick={() => dateInputRef.current && dateInputRef.current.showPicker()}
                    style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid #ced4da',
                        backgroundColor: '#fff'
                    }}
                >
                    <i className="fa fa-calendar text-muted"></i>
                    <span>{formatDisplayDate(currentDate)}</span>
                    <i className="fa fa-caret-down text-muted ml-1" style={{ fontSize: '0.7rem' }}></i>
                </Button>
                {/* Hidden native date input to trigger calendar UI */}
                <input
                    ref={dateInputRef}
                    type="date"
                    value={currentDate}
                    onChange={handleDateChange}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        visibility: 'hidden'
                    }}
                />
            </div>

            {/* VERTICAL DIVIDER */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e9ecef', margin: '0 4px' }} />

            {/* TIME RANGE */}
            <InputGroup size="sm" style={{ width: 'auto' }}>
                <div className="input-group-prepend">
                    <span className="input-group-text" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#6c757d', backgroundColor: 'transparent', border: 'none', fontWeight: '500' }}>
                        From
                    </span>
                </div>
                <Input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px' }}
                />
                <div className="input-group-prepend input-group-append">
                    <span className="input-group-text" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'transparent', border: 'none', color: '#adb5bd' }}>
                        —
                    </span>
                </div>
                <div className="input-group-prepend">
                    <span className="input-group-text" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#6c757d', backgroundColor: 'transparent', border: 'none', fontWeight: '500' }}>
                        To
                    </span>
                </div>
                <Input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px' }}
                />
                <div className="input-group-append ml-2">
                    <Button
                        color="primary"
                        size="sm"
                        onClick={handleApplyCustom}
                        style={{ padding: '0.25rem 1rem', fontSize: '0.8rem', fontWeight: '500', borderRadius: '4px' }}
                    >
                        Apply
                    </Button>
                </div>
            </InputGroup>
        </div>
    );
};

TimeWindowFilter.propTypes = {
    selectedWindow: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
    onWindowChange: PropTypes.func.isRequired,
    isLive: PropTypes.bool.isRequired,
    setIsLive: PropTypes.func.isRequired
};

export default TimeWindowFilter;
