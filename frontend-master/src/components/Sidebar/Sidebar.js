import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';

import LinksGroup from './LinksGroup/LinksGroup';
import { fetchReportedIssuesCount } from '../../actions/driverIssues';
import { fetchEscalationCount } from '../../actions/escalationCount';
import { fetchUnassignedBookingsCount, updateUnassignedCount } from '../../actions/unassignedBookings';
import { fetchUnlockedBookingsCount } from '../../actions/unlockedBookings';
import opsWebSocket from '../../services/opsWebSocket';

import s from './Sidebar.module.scss';

const SIDEBAR_POLL_MS = 60000;
const UNLOCKED_POLL_MS = 30000;

class Sidebar extends Component {
  componentDidMount() {
    this.props.dispatch(fetchReportedIssuesCount());
    this.props.dispatch(fetchUnassignedBookingsCount());
    this.props.dispatch(fetchEscalationCount());
    this.props.dispatch(fetchUnlockedBookingsCount());

    this.countInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      this.props.dispatch(fetchReportedIssuesCount());
      this.props.dispatch(fetchUnassignedBookingsCount());
      this.props.dispatch(fetchEscalationCount());
    }, SIDEBAR_POLL_MS);

    this.unlockedInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      this.props.dispatch(fetchUnlockedBookingsCount());
    }, UNLOCKED_POLL_MS);

    this.unsubEscalation = opsWebSocket.subscribe('escalation', (data) => {
      if (typeof data.count === 'number') {
        this.props.dispatch(updateUnassignedCount(data.count));
      } else if (Array.isArray(data.unassigned)) {
        this.props.dispatch(updateUnassignedCount(data.unassigned.length));
      }
    });
    this.unsubClear = opsWebSocket.subscribe('clear_all', () => {
      this.props.dispatch(updateUnassignedCount(0));
    });
  }

  componentWillUnmount() {
    if (this.countInterval) {
      clearInterval(this.countInterval);
    }
    if (this.unlockedInterval) {
      clearInterval(this.unlockedInterval);
    }
    if (this.unsubEscalation) this.unsubEscalation();
    if (this.unsubClear) this.unsubClear();
  }

  render() {
    const { reportedCount, unassignedCount, escalationCount, unlockedCount } = this.props;

    return (
      <nav className={s.root}>
        <header className={s.logo}>
          <div className={s.logoWrapper}>
            <Link to="/app/operations-dashboard">
              <img src={`${process.env.PUBLIC_URL || ''}/logo.png`} alt="Logo" />
            </Link>
          </div>
        </header>
        <ul className={s.nav}>
          <LinksGroup
            header="📊  Dashboard"
            headerLink="/app/operations-dashboard"
          />
          <LinksGroup
            header="🛺  Drivers"
            headerLink="/app/drivers"
          />
          <LinksGroup
            header="📋  Active Rides"
            headerLink="/app/bookings"
          />
          <LinksGroup
            header="💳  Payment Center"
            headerLink="/app/payment-center"
          />
          <li className={s.sidebarSection}>
            <span>LIVE TRACKING</span>
          </li>
          <LinksGroup
            header="🗺️  Live Auto Map"
            headerLink="/app/ops/map"
            opsMap
          />
        </ul>
      </nav>
    );
  }
}

function mapStateToProps(store) {
  return {
    sidebarOpened: store.navigation.sidebarOpened,
    sidebarStatic: store.navigation.sidebarStatic,
    unassignedCount: store.unassignedBookings.unassignedCount,
    escalationCount: store.escalationCount.escalationCount || 0,
    reportedCount: store.driverIssues ? store.driverIssues.reportedCount : 0,
    unlockedCount: store.unlockedBookings ? store.unlockedBookings.unlockedCount : null,
  };
}

export default withRouter(connect(mapStateToProps)(Sidebar));
