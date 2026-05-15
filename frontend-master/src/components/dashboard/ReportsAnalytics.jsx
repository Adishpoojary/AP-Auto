import React from 'react';
import { Table, Badge } from 'reactstrap';
import Widget from '../Widget';

/**
 * ReportsAnalytics — displays aggregated analytics metrics for the Operations Control Center.
 * Data is fetched from GET /api/dashboard/reports.
 *
 * Props:
 *  data   - object { daily_bookings, driver_performance, customer_performance, total_revenue, driver_earnings }
 *  loading - boolean
 */
const ReportsAnalytics = ({ data, loading }) => {
  const formatCurrency = (val) =>
    typeof val === 'number'
      ? `₹${val.toLocaleString('en-IN')}`
      : '—';

  const formatPercent = (val) =>
    typeof val === 'number' ? `${val}%` : '—';

  const rows = [
    {
      label: 'Daily Bookings',
      value: data?.daily_bookings ?? '—',
      render: (v) => (
        <Badge color="primary" pill>
          {v}
        </Badge>
      ),
    },
    {
      label: 'Driver Performance',
      value: data?.driver_performance,
      render: (v) => (
        <Badge color={v >= 80 ? 'success' : v >= 50 ? 'warning' : 'danger'} pill>
          {formatPercent(v)}
        </Badge>
      ),
    },
    {
      label: 'Customer Performance',
      value: data?.customer_performance,
      render: (v) => (
        <Badge color={v >= 80 ? 'success' : v >= 50 ? 'warning' : 'danger'} pill>
          {formatPercent(v)}
        </Badge>
      ),
    },
  ];

  return (
    <Widget
      title={
        <h5 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
          📊 Reports &amp; Analytics
        </h5>
      }
      className="mb-0 h-100 shadow-sm border-0"
    >
      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '120px' }}>
          <div className="spinner-border text-light" role="status" style={{ opacity: 0.5 }} />
        </div>
      ) : (
        <Table borderless size="sm" className="mb-0">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="text-muted" style={{ paddingLeft: 0 }}>
                  {row.label}
                </td>
                <td className="text-right" style={{ paddingRight: 0 }}>
                  {row.render(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Widget>
  );
};

export default ReportsAnalytics;
