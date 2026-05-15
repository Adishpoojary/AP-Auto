import React from 'react';
import Widget from '../Widget';

const ActivityFeed = ({ activities }) => {
  const scrollStyle = { maxHeight: '280px', overflowY: 'auto' };
  return (
    <Widget title={<h5>Recent Activity</h5>} className="mb-0 h-100 shadow-sm border-0">
      <div style={scrollStyle}>
        {(!activities || activities.length === 0) ? (
          <div className="text-center text-muted py-4">
            No recent activity found.
          </div>
        ) : (
          <ul className="list-unstyled mb-0 w-100">
            {activities.map((activity, idx) => (
              <li key={idx} className="mb-3 d-flex py-2 border-bottom">
                <div className="mr-3">
                  <i className={`fa fa-circle text-${activity.type === 'Driver Added' ? 'success' : 'warning'}`} style={{ fontSize: '0.75rem' }} />
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between">
                    <span className="font-weight-bold">{activity.type}</span>
                    <small className="text-muted">{activity.time_str}</small>
                  </div>
                  <div className="text-muted mt-1">{activity.description}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Widget>
  );
};

export default ActivityFeed;
