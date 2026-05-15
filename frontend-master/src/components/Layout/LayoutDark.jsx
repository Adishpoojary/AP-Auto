import React from 'react';
import { Switch, Route, Redirect, withRouter } from 'react-router';

import SidebarDark from '../Sidebar/SidebarDark';

import DashboardDark from '../../pages/dashboard/DashboardDark';
import DriverListDark from '../../pages/drivers/list/DriverListDark';
import DriverEdit from '../../pages/drivers/edit/DriverEdit';
import BookingsDark from '../../pages/bookings/BookingsDark';
import PaymentsDark from '../../pages/payments/PaymentsDark';
import FleetMapDark from '../../pages/ops/FleetMapDark';
import NotFound from '../../pages/notFound';
import Profile from '../../pages/profile';
import Privacy from '../../pages/privacy';

import '../../styles/ap-dark-redesign.css';

const LayoutDark = () => {
  return (
    <div className="ap-layout">
      <SidebarDark />
      <div className="ap-main">
        <Switch>
          <Route path="/app/main" exact render={() => <Redirect to="/app/operations-dashboard" />} />
          <Route path="/app/operations-dashboard" exact component={DashboardDark} />
          <Route path="/app/drivers/:id/edit" exact component={DriverEdit} />
          <Route path="/app/drivers" exact component={DriverListDark} />
          <Route path="/app/bookings" exact component={BookingsDark} />
          <Route path="/app/payment-center" exact component={PaymentsDark} />
          <Route path="/app/ops/map" exact component={FleetMapDark} />
          <Route path="/app/privacy" exact component={Privacy} />
          <Route path="/app/profile" exact component={Profile} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
};

export default withRouter(LayoutDark);
