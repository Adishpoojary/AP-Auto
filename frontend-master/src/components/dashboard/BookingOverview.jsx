import React, { useState, useEffect } from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

/**
 * BookingOverview
 *
 * @param {{ data: object, onFieldClick?: (filter: string) => void, idleDriversCount?: number, onIdleDriversClick?: () => void }} props
 * onFieldClick — optional. When provided, each row becomes clickable and opens a drill-down panel.
 * idleDriversCount — from shared ops WebSocket `idle_drivers` (same source as Trip Escalations).
 */
const BookingOverview = ({ data, onFieldClick, idleDriversCount = 0, onIdleDriversClick }) => {
  const clickable = typeof onFieldClick === 'function';

  const rowStyle = clickable
    ? { cursor: 'pointer', transition: 'background 0.15s' }
    : {};

  const hoverHandlers = (filter) =>
    clickable
      ? {
          onClick: () => onFieldClick(filter),
          onMouseEnter: (e) => (e.currentTarget.style.background = '#f0f7ff'),
          onMouseLeave: (e) => (e.currentTarget.style.background = ''),
        }
      : {};

  const idleClickable = typeof onIdleDriversClick === 'function';
  const idleRowHandlers = idleClickable
    ? {
        onClick: () => onIdleDriversClick(),
        onMouseEnter: (e) => (e.currentTarget.style.background = '#f0f7ff'),
        onMouseLeave: (e) => (e.currentTarget.style.background = ''),
      }
    : {};
  const idleRowStyle = idleClickable ? rowStyle : {};

  const unassignedCount = data?.unassigned_bookings || 0;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (unassignedCount === 0) {
      setDismissed(false);
    }
  }, [unassignedCount]);

  const showAlert = unassignedCount > 0 && !dismissed;

  return (
    <Widget 
      title={<h5>Booking Overview</h5>} 
      className={`mb-0 h-100 shadow-sm border-0 ${showAlert ? 'alert-card alert-unassigned' : ''}`}
      onClick={showAlert ? () => setDismissed(true) : undefined}
    >
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr style={rowStyle} {...hoverHandlers('assigned')} title={clickable ? 'Click to view assigned bookings' : undefined}>
            <td className="text-muted">Assigned</td>
            <td className="text-right font-weight-bold">
              <Badge color="primary">{data?.assigned_bookings || 0}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('unassigned')} title={clickable ? 'Click to view unassigned bookings' : undefined}>
            <td className="text-muted">Unassigned</td>
            <td className="text-right font-weight-bold">
              <Badge color="danger">{unassignedCount}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('pending')} title={clickable ? 'Click to view pending bookings' : undefined}>
            <td className="text-muted">Pending</td>
            <td className="text-right font-weight-bold">
              <Badge style={{ backgroundColor: '#fff', color: '#333', border: '1px solid #dee2e6' }}>
                {data?.pending_bookings || 0}
              </Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('completed')} title={clickable ? 'Click to view completed bookings' : undefined}>
            <td className="text-muted">Completed</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.completed_bookings || 0}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('cancelled')} title={clickable ? 'Click to view cancelled bookings' : undefined}>
            <td className="text-muted">Cancelled</td>
            <td className="text-right font-weight-bold">
              <Badge color="danger">{data?.cancelled_bookings || 0}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('unlocked')} title={clickable ? 'Click to view unlocked bookings' : undefined}>
            <td className="text-muted">
              Unlocked
            </td>
            <td className="text-right font-weight-bold">
              <Badge style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
                {data?.unlocked_bookings || 0}
              </Badge>
            </td>
          </tr>
          <tr
            style={idleRowStyle}
            {...idleRowHandlers}
            title={idleClickable ? 'Open Trip Escalations (idle drivers)' : undefined}
          >
            <td className="text-muted">🏠 Idle Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge
                color={idleDriversCount > 0 ? 'warning' : 'secondary'}
                style={{
                  fontWeight: idleDriversCount > 0 ? 600 : 400,
                  animation:
                    idleDriversCount > 0 ? 'opsIdleDriversPulse 2s infinite' : 'none',
                }}
              >
                {idleDriversCount}
              </Badge>
            </td>
          </tr>
        </tbody>
      </Table>
    </Widget>
  );
};

export default BookingOverview;
