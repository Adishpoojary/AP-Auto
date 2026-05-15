import React, { useState, useEffect } from 'react';
import { Badge, Table } from 'reactstrap';
import Widget from '../Widget';

/**
 * EscalationsPanel — displays escalation counts by domain category for the Operations Control Center.
 * Data is fetched from GET /api/dashboard/escalations.
 *
 * Props:
 *  data   - object { driver_issues, customer_complaints, payment_disputes, trip_issues, technical_issues }
 *  loading - boolean
 *  onFieldClick - function to handle row clicks for drill-down
 */
const EscalationsPanel = ({ data, loading, onFieldClick }) => {
  const rows = [
    { label: 'Driver Issues', filter: 'driver_issues', value: data?.driver_issues ?? 0, color: 'danger' },
    { label: 'Customer Complaints', filter: 'customer_complaints', value: data?.customer_complaints ?? 0, color: 'warning' },
    { label: 'Payment Disputes', filter: 'payment_disputes', value: data?.payment_disputes ?? 0, color: 'primary', badgeStyle: { backgroundColor: '#6f42c1' } },
    { label: 'Trip Issues', filter: 'trip_issues', value: data?.trip_issues ?? 0, color: 'info' },
    { label: 'Technical Issues', filter: 'technical_issues', value: data?.technical_issues ?? 0, color: 'secondary' },
  ];

  const totalEscalations = rows.reduce((acc, row) => acc + row.value, 0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (totalEscalations === 0) {
      setDismissed(false);
    }
  }, [totalEscalations]);

  const showAlert = totalEscalations > 0 && !dismissed;

  return (
    <Widget
      title={
        <h5 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
          Escalations &amp; Issues
        </h5>
      }
      className={`mb-0 h-100 shadow-sm border-0 ${showAlert ? 'alert-card alert-escalation' : ''}`}
      onClick={showAlert ? () => setDismissed(true) : undefined}
    >
      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '120px' }}>
          <div className="spinner-border text-light" role="status" style={{ opacity: 0.5 }} />
        </div>
      ) : (
        <Table borderless size="sm" className="mb-0">
          <tbody>
            {rows.map((row) => (
              <tr 
                key={row.label} 
                onClick={() => onFieldClick && onFieldClick(row.filter)}
                style={{ cursor: onFieldClick ? 'pointer' : 'default', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => {
                  if (onFieldClick) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (onFieldClick) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td className="text-muted" style={{ paddingLeft: 0 }}>{row.label}</td>
                <td className="text-right font-weight-bold" style={{ paddingRight: 0 }}>
                  <Badge color={row.badgeStyle ? undefined : row.color} pill style={row.badgeStyle}>
                    {row.value}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Widget>
  );
};

export default EscalationsPanel;
