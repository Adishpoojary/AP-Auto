import React, { useState, useEffect } from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

/**
 * TripsOverview card.
 *
 * @param {{ data: object, onFieldClick?: (filter: string) => void }} props
 */
const TripsOverview = ({ data, onFieldClick }) => {
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

  const delayedCount = data?.delayed_trips || 0;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (delayedCount === 0) {
      setDismissed(false);
    }
  }, [delayedCount]);

  const showAlert = delayedCount > 0 && !dismissed;

  return (
    <Widget 
      title={<h5>Trips Overview</h5>} 
      className={`mb-0 h-100 shadow-sm border-0 ${showAlert ? 'alert-card alert-delayed' : ''}`}
      onClick={showAlert ? () => setDismissed(true) : undefined}
    >
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr style={rowStyle} {...hoverHandlers('ongoing')} title={clickable ? 'Click to view ongoing trips' : undefined}>
            <td className="text-muted">Ongoing Trips</td>
            <td className="text-right font-weight-bold">
              <Badge color="primary">{data?.ongoing_trips || 0}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('delayed')} title={clickable ? 'Click to view delayed trips' : undefined}>
            <td className="text-muted">Delayed Trips</td>
            <td className="text-right font-weight-bold">
              <Badge color="danger">{delayedCount}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('completed')} title={clickable ? 'Click to view completed trips' : undefined}>
            <td className="text-muted">Completed Trips</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.completed_trips || 0}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} {...hoverHandlers('cancelled')} title={clickable ? 'Click to view cancelled trips' : undefined}>
            <td className="text-muted">Cancelled Trips</td>
            <td className="text-right font-weight-bold">
              <Badge style={{ backgroundColor: '#a5b4fc', color: '#1e3a8a' }}>{data?.cancelled_trips || 0}</Badge>
            </td>
          </tr>
        </tbody>
      </Table>
    </Widget>
  );
};

export default TripsOverview;


