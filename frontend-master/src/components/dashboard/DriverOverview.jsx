import React from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

const DriverOverview = ({ data }) => {
  return (
    <Widget title={<h5>Driver Monitoring</h5>} className="mb-0 h-100 shadow-sm border-0">
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr>
            <td className="text-muted">Active Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.active_drivers || 0}</Badge>
            </td>
          </tr>
          <tr>
            <td className="text-muted">Offline Drivers</td>
            <td className="text-right font-weight-bold">
              <Badge color="secondary">{data?.offline_drivers || 0}</Badge>
            </td>
          </tr>
          {/* Note: In a complete implementation we might also pass more detailed driver stats here if available, but staying consistent with fleet overview style */}
          {/* Available and Busy are shown in FleetOverview, so we keep this focused on driver-specific status */}
        </tbody>
      </Table>
    </Widget>
  );
};

export default DriverOverview;
