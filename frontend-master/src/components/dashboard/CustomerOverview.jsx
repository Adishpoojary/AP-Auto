import React, { useState, useEffect } from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

const ROW_STYLE = {
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const CustomerOverview = ({ data, onFieldClick }) => {
  const handleClick = (filter) => {
    if (onFieldClick) onFieldClick(filter);
  };

  const flaggedCount = data?.flagged_customers || 0;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (flaggedCount === 0) {
      setDismissed(false);
    }
  }, [flaggedCount]);

  const showAlert = flaggedCount > 0 && !dismissed;

  return (
    <Widget 
      title={<h5>Customer Overview</h5>} 
      className={`mb-0 h-100 shadow-sm border-0 ${showAlert ? 'alert-card alert-flagged' : ''}`}
      onClick={showAlert ? () => setDismissed(true) : undefined}
    >
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr
            style={ROW_STYLE}
            onClick={() => handleClick('new')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view New Customers"
          >
            <td className="text-muted">New Customers</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.new_customers || 0}</Badge>
            </td>
          </tr>
          <tr
            style={ROW_STYLE}
            onClick={() => handleClick('active')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Active Customers"
          >
            <td className="text-muted">Active Customers</td>
            <td className="text-right font-weight-bold">
              <Badge color="primary">{data?.active_customers || 0}</Badge>
            </td>
          </tr>
          <tr
            style={ROW_STYLE}
            onClick={() => handleClick('repeat')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ecfeff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Repeat Customers"
          >
            <td className="text-muted">Repeat Customers</td>
            <td className="text-right font-weight-bold">
              <Badge color="info">{data?.repeat_customers || 0}</Badge>
            </td>
          </tr>
          <tr
            style={ROW_STYLE}
            onClick={() => handleClick('flagged')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fffbeb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Flagged Customers"
          >
            <td className="text-muted">Flagged Customers</td>
            <td className="text-right font-weight-bold">
              <Badge color="warning">{flaggedCount}</Badge>
            </td>
          </tr>
          <tr
            style={ROW_STYLE}
            onClick={() => handleClick('blocked')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Blocked Customers"
          >
            <td className="text-muted">Blocked Customers</td>
            <td className="text-right font-weight-bold">
              <Badge color="danger">{data?.blocked_customers || 0}</Badge>
            </td>
          </tr>
          {data?.last_booking && (
            <tr>
              <td className="text-muted" colSpan="2" style={{ fontSize: '0.8rem', paddingTop: '10px' }}>
                Last Booking: {new Date(data.last_booking).toLocaleString()}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Widget>
  );
};

export default CustomerOverview;
