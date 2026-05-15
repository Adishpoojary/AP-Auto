import React from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

const VehicleOverview = ({ data }) => {
  return (
    <Widget title={<h5>Vehicle Overview</h5>} className="mb-0 h-100 shadow-sm border-0">
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr>
            <td className="text-muted">Total Vehicles</td>
            <td className="text-right font-weight-bold">
              <Badge color="secondary">{data?.total_vehicles || 0}</Badge>
            </td>
          </tr>
          <tr>
            <td className="text-muted">Available Vehicles</td>
            <td className="text-right font-weight-bold">
              <Badge color="success">{data?.available_vehicles || 0}</Badge>
            </td>
          </tr>
          <tr>
            <td className="text-muted">Assigned Vehicles</td>
            <td className="text-right font-weight-bold">
              <Badge color="primary">{data?.assigned_vehicles || 0}</Badge>
            </td>
          </tr>
        </tbody>
      </Table>
    </Widget>
  );
};

export default VehicleOverview;
