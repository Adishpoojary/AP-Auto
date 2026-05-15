import React from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

const RevenueMonitoring = ({ data, onOpenPanel }) => {
  const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN')}`;
  const openRevenuePanel = (metric) => {
    if (onOpenPanel) onOpenPanel({ type: 'revenue', metric });
  };

  const rowStyle = {
    cursor: onOpenPanel ? 'pointer' : 'default',
  };

  return (
    <Widget title={<h5 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>💰 Revenue Monitoring</h5>} className="mb-0 h-100 shadow-sm border-0">
      <Table borderless size="sm" className="mb-0">
        <tbody>
          <tr style={rowStyle} onClick={() => openRevenuePanel('total')}>
            <td className="text-muted" style={{ paddingLeft: 0 }}>Total Revenue</td>
            <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
              <Badge color="success" pill>{formatCurrency(data?.total_revenue ?? data?.revenue_today)}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} onClick={() => openRevenuePanel('weekly')}>
            <td className="text-muted" style={{ paddingLeft: 0 }}>Weekly Revenue</td>
            <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
              <Badge color="info" pill>{formatCurrency(data?.weekly_revenue)}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} onClick={() => openRevenuePanel('monthly')}>
            <td className="text-muted" style={{ paddingLeft: 0 }}>Monthly Revenue</td>
            <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
              <Badge color="primary" pill>{formatCurrency(data?.monthly_revenue)}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} onClick={() => openRevenuePanel('driver')}>
            <td className="text-muted" style={{ paddingLeft: 0 }}>Driver Earnings</td>
            <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
              <Badge color="secondary" pill>{formatCurrency(data?.driver_earnings)}</Badge>
            </td>
          </tr>
          <tr style={rowStyle} onClick={() => openRevenuePanel('pending')}>
            <td className="text-muted" style={{ paddingLeft: 0 }}>Pending Payments</td>
            <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
              <Badge color="warning" pill>{formatCurrency(data?.pending_payments)}</Badge>
            </td>
          </tr>
        </tbody>
      </Table>
    </Widget>
  );
};

export default RevenueMonitoring;
