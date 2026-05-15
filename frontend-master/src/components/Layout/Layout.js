/**
 * Flatlogic Dashboards (https://flatlogic.com/admin-dashboards)
 *
 * Copyright © 2015-present Flatlogic, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import cx from 'classnames';
import { useLocation } from 'react-router-dom';
import { Switch, Route, Redirect, withRouter } from 'react-router';

import s from './Layout.module.scss';
import '../../styles/ap-dark-overrides.css';
import Header from '../Header';
import Footer from '../Footer';
import Sidebar from '../Sidebar';
import { CityProvider } from '../../contexts/CityContext';
import { DateFilterProvider } from '../../contexts/DateFilterContext';
import { ChatProvider, useChat } from '../../contexts/ChatContext';

import OperationsDashboard from '../../pages/dashboard/OperationsDashboard'
import Drivers from '../../pages/drivers/Drivers'
import Buttons from '../../pages/buttons'
import Charts from '../../pages/charts'
import Maps from '../../pages/google'
import NotFound from '../../pages/notFound'
import Icons from '../../pages/icons'
import Bookings from '../../pages/bookings/Bookings'
import PaymentCenterPage from '../../pages/payments/PaymentCenterPage'

import Notifications from '../../pages/notifications'
import Profile from '../../pages/profile'
import Privacy from '../../pages/privacy'


import OpsMapDashboard from '../../pages/ops/OpsMapDashboard'

// ─── Inner Layout (functional – can use hooks) ───────────────────────────────
const LayoutInner = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { chatState, minimizeChat, closeChat } = useChat();
  const location = useLocation();

  // Dark Mode Persistence Persistence
  React.useEffect(() => {
    const isDark = localStorage.getItem('ap-dark-mode') === 'true';
    if (isDark) {
      document.body.classList.add('ap-dark-mode');
    } else {
      document.body.classList.remove('ap-dark-mode');
    }
  }, [location.pathname]);

  return (
    <div className={s.root}>
      <Sidebar />
      <div className={cx(s.wrap, { [s.sidebarOpen]: sidebarOpen })}>
        <Header sidebarToggle={() => setSidebarOpen(prev => !prev)} />

        <main className={s.content}>
          <Switch>
            <Route path="/app/main" exact render={() => <Redirect to="/app/operations-dashboard" />} />
            <Route path="/app/drivers" component={Drivers} />
            <Route path="/app/bookings" exact component={Bookings} />
            <Route path="/app/payment-center" exact component={PaymentCenterPage} />

            {/* Ops Map Dashboard */}
            <Route path="/app/ops/map" exact component={OpsMapDashboard} />

            {/* Logistics Operations Dashboard */}
            <Route path="/app/operations-dashboard" exact component={OperationsDashboard} />

            <Route path="/app/privacy" exact component={Privacy} />
            <Route path="/app/profile" exact component={Profile} />
            <Route path="/app/notifications" exact component={Notifications} />
            <Route path="/app/components/buttons" exact component={Buttons} />
            <Route path="/app/components/charts" exact component={Charts} />
            <Route path="/app/components/icons" exact component={Icons} />
            <Route path="/app/components/maps" exact component={Maps} />
            <Route component={NotFound} />
          </Switch>
        </main>

        <Footer />
      </div>

      {/* ── Global Chat Modals Removed ────────────────────────────────────── */}

      {/* Floating minimized bubble – persists across navigation */}
    </div>
  );
};

// ─── Layout class wrapper (provides context providers) ───────────────────────
class Layout extends React.Component {
  render() {
    return (
      <CityProvider>
        <DateFilterProvider>
          <ChatProvider>
            <LayoutInner />
          </ChatProvider>
        </DateFilterProvider>
      </CityProvider>
    );
  }
}

export default withRouter(Layout);
