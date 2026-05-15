import React from 'react';
import { Switch, Route, withRouter } from 'react-router';

import DriverList from './list/DriverList';
import DriverEdit from './edit/DriverEdit';

class Drivers extends React.Component {
  render() {
    return (
      <Switch>
        <Route path="/app/drivers" exact component={DriverList} />
        <Route path="/app/drivers/:id/edit" exact component={DriverEdit} />
      </Switch>
    );
  }
}

export default withRouter(Drivers);