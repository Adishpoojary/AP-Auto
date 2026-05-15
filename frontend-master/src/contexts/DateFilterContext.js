import React, { createContext, useState, useContext, useEffect } from 'react';

const DateFilterContext = createContext();

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};

export const DateFilterProvider = ({ children }) => {
  const [dateRange, setDateRangeState] = useState(() => {
    // Get from localStorage on initial load
    const stored = localStorage.getItem('dateFilterRange');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return { startDate: '', endDate: '' };
      }
    }
    return { startDate: '', endDate: '' };
  });

  const updateDateRange = (startDate, endDate) => {
    const newRange = { startDate, endDate };
    setDateRangeState(newRange);
    localStorage.setItem('dateFilterRange', JSON.stringify(newRange));
  };

  const clearDateFilter = () => {
    const emptyRange = { startDate: '', endDate: '' };
    setDateRangeState(emptyRange);
    localStorage.removeItem('dateFilterRange');
  };

  /** Object form — same global state as header (single day: startDate === endDate). */
  const setDateRange = (range) => {
    if (!range) {
      clearDateFilter();
      return;
    }
    const s = range.startDate ?? '';
    const e = range.endDate ?? '';
    if (!s && !e) clearDateFilter();
    else updateDateRange(s, e);
  };

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    updateDateRange(today, today);
  };

  const setLast7Days = () => {
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    updateDateRange(last7Days.toISOString().split('T')[0], today.toISOString().split('T')[0]);
  };

  const setLast30Days = () => {
    const today = new Date();
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    updateDateRange(last30Days.toISOString().split('T')[0], today.toISOString().split('T')[0]);
  };

  const isDateInRange = (dateStr) => {
    if (!dateRange.startDate && !dateRange.endDate) {
      return true; // No filter applied
    }

    if (!dateStr) {
      return true; // No date to compare, include the item
    }

    try {
      // Parse the date and normalize to start of day (midnight) for comparison
      const date = new Date(dateStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateStr);
        return true; // Invalid date, include the item
      }
      
      date.setHours(0, 0, 0, 0);
      
      const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      
      const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
      if (end) end.setHours(23, 59, 59, 999); // End of day

      const result = (() => {
        if (start && end) {
          return date >= start && date <= end;
        } else if (start) {
          return date >= start;
        } else if (end) {
          return date <= end;
        }
        return true;
      })();

      return result;
    } catch (e) {
      console.error('Date parsing error:', e, 'for date:', dateStr);
      return true; // If date parsing fails, include the item
    }
  };

  return (
    <DateFilterContext.Provider 
      value={{ 
        dateRange, 
        setDateRange,
        updateDateRange, 
        clearDateFilter, 
        setToday, 
        setLast7Days, 
        setLast30Days,
        isDateInRange
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};

export default DateFilterContext;