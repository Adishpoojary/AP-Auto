import React, { useState, useMemo } from 'react';
import Widget from '../Widget';
import { Progress, Dropdown, DropdownToggle, DropdownMenu } from 'reactstrap';
import { useDateFilter } from '../../contexts/DateFilterContext';

const KPICard = ({
  title,
  value,
  icon,
  color,
  progress,
  subtitle,
  linkDateFilter,
  onIconClick,
}) => {
  const { dateRange, setDateRange } = useDateFilter();
  const [calOpen, setCalOpen] = useState(false);

  const singleDayValue = useMemo(() => {
    const s = dateRange?.startDate;
    const e = dateRange?.endDate;
    if (s && e && s === e) return s;
    return '';
  }, [dateRange?.startDate, dateRange?.endDate]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const iconBlock = linkDateFilter ? (
    <Dropdown isOpen={calOpen} toggle={() => setCalOpen((o) => !o)} className="d-flex align-items-center">
      <DropdownToggle
        tag="div"
        caret={false}
        className={`metric-icon-wrapper text-${color} border-0 bg-transparent p-0 m-0`}
        style={{ cursor: 'pointer', boxShadow: 'none' }}
        aria-label="Pick date for dashboard filter"
        title="Click to filter by date"
      >
        <i className={`fa ${icon} metric-card-icon fa-3x opacity-70`} />
      </DropdownToggle>
      <DropdownMenu right className="px-3 py-2" style={{ minWidth: '200px' }}>
        <label className="small d-block mb-1 text-muted">Dashboard date</label>
        <input
          type="date"
          className="form-control form-control-sm"
          value={singleDayValue}
          max={todayStr}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              setDateRange({ startDate: v, endDate: v });
              setCalOpen(false);
            }
          }}
        />
        <small className="text-muted d-block mt-2" style={{ fontSize: '11px' }}>
          Same as header date filter
        </small>
      </DropdownMenu>
    </Dropdown>
  ) : onIconClick ? (
    <div
      role="button"
      tabIndex={0}
      className={`metric-icon-wrapper text-${color}`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.preventDefault();
        onIconClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onIconClick();
        }
      }}
      title="Open details"
      aria-label={`Open ${title} details`}
    >
      <i className={`fa ${icon} metric-card-icon fa-3x opacity-70`} />
    </div>
  ) : (
    <div className={`metric-icon-wrapper text-${color}`}>
      <i className={`fa ${icon} metric-card-icon fa-3x opacity-70`} />
    </div>
  );

  return (
    <Widget className="mb-4 h-100 shadow-sm border-0 bg-white">
      <div className="d-flex align-items-center">
        <div className="mr-auto">
          <h6 className="text-muted mb-1 metric-card-title">{title}</h6>
          <h2 className={`mb-0 font-weight-bold metric-card-value text-${color === 'warning' ? 'dark' : 'dark'}`}>
            {value}
          </h2>
        </div>
        {iconBlock}
      </div>
      {progress !== undefined && (
        <div className="mt-3">
          <Progress color={color} value={progress} />
          {subtitle && (
            <small className="text-muted mt-1 d-block">{subtitle}</small>
          )}
        </div>
      )}
    </Widget>
  );
};

export default KPICard;
