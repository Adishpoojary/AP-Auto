import React from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

const ROW_STYLE = {
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const FleetOverview = ({ data, onFieldClick, registeredMetric }) => {
  const handle = (filter) => { if (onFieldClick) onFieldClick(filter); };

  return (
    <Widget title={<h5>Fleet Monitoring</h5>} className="mb-0 h-100 shadow-sm border-0">
      <Table borderless size="sm" className="mb-0">
        <tbody>
          {/* Total Vehicles — now clickable */}
          <tr
            style={ROW_STYLE}
            onClick={() => handle('total_vehicles')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view all Vehicles"
          >
            <td className="text-muted">Total Vehicles</td>
            <td className="text-right font-weight-bold">
              <Badge color="secondary">{data?.total_vehicles || 0}</Badge>
            </td>
          </tr>

          <tr
            style={ROW_STYLE}
            onClick={() => handle('active_drivers')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Active Drivers"
          >
            <td className="text-muted">Active Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.active_drivers || 0}</Badge>
            </td>
          </tr>

          <tr
            style={ROW_STYLE}
            onClick={() => handle('available_drivers')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ecfeff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Available Drivers"
          >
            <td className="text-muted">Available Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="info">{data?.available_drivers || 0}</Badge>
            </td>
          </tr>

          <tr
            style={ROW_STYLE}
            onClick={() => handle('busy_drivers')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Busy Drivers"
          >
            <td className="text-muted">Busy Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="primary">{data?.busy_drivers || 0}</Badge>
            </td>
          </tr>

          <tr
            style={ROW_STYLE}
            onClick={() => handle('offline_drivers')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="Click to view Offline Drivers"
          >
            <td className="text-muted">Offline Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="secondary">{data?.offline_drivers || 0}</Badge>
            </td>
          </tr>

          <tr
            style={ROW_STYLE}
            onClick={() => handle('registered_vehicles')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title={`Click to view ${registeredMetric?.label || 'Registered Vehicles'}`}
          >
            <td className="text-muted">{registeredMetric?.label || 'Registered Vehicles'}</td>
            <td className="text-right font-weight-bold">
              <Badge color="secondary">{registeredMetric?.count || 0}</Badge>
            </td>
          </tr>
        </tbody>
      </Table>
    </Widget>
  );
};

export default FleetOverview;
