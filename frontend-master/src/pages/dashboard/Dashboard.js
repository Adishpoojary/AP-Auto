import React, {Component} from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import {
  Row,
  Col,
  Breadcrumb,
  BreadcrumbItem,
  Progress,
  Badge,
  Table,
  Card,
  CardBody
} from 'reactstrap';

import Widget from '../../components/Widget';

import { fetchDrivers } from '../../actions/drivers';
import { fetchVehicles } from '../../actions/vehicles';
import s from './Dashboard.module.scss';

class Dashboard extends Component {
  /* eslint-disable */
  static propTypes = {
    drivers: PropTypes.array,
    vehicles: PropTypes.array,
    isFetchingDrivers: PropTypes.bool,
    isFetchingVehicles: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  };
  /* eslint-enable */

  static defaultProps = {
    drivers: [],
    vehicles: [],
    isFetchingDrivers: false,
    isFetchingVehicles: false,
  };

  componentDidMount() {
    this.props.dispatch(fetchDrivers());
    this.props.dispatch(fetchVehicles());
  }

  getDriverStats = () => {
    const { drivers } = this.props;
    
    return {
      total: drivers.length,
      active: drivers.filter(d => !d.is_blocked && d.verification_status === 'verified').length,
      pending: drivers.filter(d => d.verification_status === 'pending').length,
      blocked: drivers.filter(d => d.is_blocked).length,
    };
  }

  getVehicleStats = () => {
    const { vehicles } = this.props;
    
    return {
      total: vehicles.length,
      active: vehicles.filter(v => v.is_active && v.status === 'active').length,
      inactive: vehicles.filter(v => !v.is_active || v.status === 'inactive').length,
      assigned: vehicles.filter(v => v.driver_id).length,
    };
  }

  getRecentDrivers = () => {
    const { drivers } = this.props;
    return drivers.slice(0, 3);
  }

  getRecentVehicles = () => {
    const { vehicles } = this.props;
    return vehicles.slice(0, 3);
  }

  render() {
    const driverStats = this.getDriverStats();
    const vehicleStats = this.getVehicleStats();
    const recentDrivers = this.getRecentDrivers();
    const recentVehicles = this.getRecentVehicles();

    return (
      <div className={s.root}>
        <Breadcrumb>
          <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
          <BreadcrumbItem active>Operations Dashboard</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="mb-lg">Operations Dashboard</h1>
        
        {/* Statistics Cards */}
        <Row>
          <Col lg={3} md={6} sm={6} xs={12}>
            <Widget className="mb-4">
              <div className="d-flex align-items-center">
                <div className="mr-auto">
                  <h6 className="text-muted mb-1">Total Drivers</h6>
                  <h2 className="mb-0">{driverStats.total}</h2>
                </div>
                <div className="text-success">
                  <i className="fa fa-users fa-3x opacity-70" />
                </div>
              </div>
              <div className="mt-3">
                <Progress color="success" value={(driverStats.active / driverStats.total * 100) || 0} />
                <small className="text-muted">
                  {driverStats.active} Active • {driverStats.pending} Pending • {driverStats.blocked} Blocked
                </small>
              </div>
            </Widget>
          </Col>

          <Col lg={3} md={6} sm={6} xs={12}>
            <Widget className="mb-4">
              <div className="d-flex align-items-center">
                <div className="mr-auto">
                  <h6 className="text-muted mb-1">Active Drivers</h6>
                  <h2 className="mb-0">{driverStats.active}</h2>
                </div>
                <div className="text-info">
                  <i className="fa fa-user-circle fa-3x opacity-70" />
                </div>
              </div>
              <div className="mt-3">
                <Progress color="info" value={(driverStats.active / driverStats.total * 100) || 0} />
                <small className="text-muted">
                  {((driverStats.active / driverStats.total * 100) || 0).toFixed(1)}% of total drivers
                </small>
              </div>
            </Widget>
          </Col>

          <Col lg={3} md={6} sm={6} xs={12}>
            <Widget className="mb-4">
              <div className="d-flex align-items-center">
                <div className="mr-auto">
                  <h6 className="text-muted mb-1">Total Vehicles</h6>
                  <h2 className="mb-0">{vehicleStats.total}</h2>
                </div>
                <div className="text-warning">
                  <i className="fa fa-truck fa-3x opacity-70" />
                </div>
              </div>
              <div className="mt-3">
                <Progress color="warning" value={(vehicleStats.active / vehicleStats.total * 100) || 0} />
                <small className="text-muted">
                  {vehicleStats.active} Active • {vehicleStats.inactive} Inactive
                </small>
              </div>
            </Widget>
          </Col>

          <Col lg={3} md={6} sm={6} xs={12}>
            <Widget className="mb-4">
              <div className="d-flex align-items-center">
                <div className="mr-auto">
                  <h6 className="text-muted mb-1">Assigned Vehicles</h6>
                  <h2 className="mb-0">{vehicleStats.assigned}</h2>
                </div>
                <div className="text-danger">
                  <i className="fa fa-car fa-3x opacity-70" />
                </div>
              </div>
              <div className="mt-3">
                <Progress color="danger" value={(vehicleStats.assigned / vehicleStats.total * 100) || 0} />
                <small className="text-muted">
                  {((vehicleStats.assigned / vehicleStats.total * 100) || 0).toFixed(1)}% vehicles assigned
                </small>
              </div>
            </Widget>
          </Col>
        </Row>

        {/* Recent Drivers and Vehicles */}
        <Row>
          <Col lg={6} md={12}>
            <Widget
              title={
                <div>
                  <div className="pull-right mt-n-xs">
                    <Link to="/app/drivers" className="btn btn-success btn-sm">
                      View All
                    </Link>
                  </div>
                  <h5 className="mt-0 mb-0">
                    <i className="fa fa-users mr-xs opacity-70" />
                    Recent Drivers{' '}
                    <Badge color="success" className="ml-xs">
                      {driverStats.total}
                    </Badge>
                  </h5>
                  <p className="fs-sm mb-0 text-muted">
                    Latest registered drivers in the system
                  </p>
                </div>
              }
            >
              {this.props.isFetchingDrivers ? (
                <div className="text-center py-4">
                  <i className="fa fa-spinner fa-spin fa-2x" />
                  <p className="mt-2">Loading drivers...</p>
                </div>
              ) : recentDrivers.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-inbox fa-3x mb-3 opacity-50" />
                  <p>No drivers found</p>
                  <Link to="/app/drivers/new" className="btn btn-success btn-sm">
                    Add First Driver
                  </Link>
                </div>
              ) : (
                <Table responsive striped className="mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Trips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDrivers.map(driver => (
                      <tr key={driver.driver_id}>
                        <td>
                          <Link to={`/app/drivers/${driver.driver_id}/edit`}>
                            {driver.name}
                          </Link>
                        </td>
                        <td>{driver.phone}</td>
                        <td>
                          <Badge color={driver.is_blocked ? 'danger' : 'success'}>
                            {driver.is_blocked ? 'Blocked' : driver.verification_status}
                          </Badge>
                        </td>
                        <td>{driver.total_trips || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Widget>
          </Col>

          <Col lg={6} md={12}>
            <Widget
              title={
                <div>
                  <div className="pull-right mt-n-xs">
                    <Link to="/app/vehicles" className="btn btn-warning btn-sm">
                      View All
                    </Link>
                  </div>
                  <h5 className="mt-0 mb-0">
                    <i className="fa fa-truck mr-xs opacity-70" />
                    Recent Vehicles{' '}
                    <Badge color="warning" className="ml-xs">
                      {vehicleStats.total}
                    </Badge>
                  </h5>
                  <p className="fs-sm mb-0 text-muted">
                    Latest registered vehicles in the fleet
                  </p>
                </div>
              }
            >
              {this.props.isFetchingVehicles ? (
                <div className="text-center py-4">
                  <i className="fa fa-spinner fa-spin fa-2x" />
                  <p className="mt-2">Loading vehicles...</p>
                </div>
              ) : recentVehicles.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-inbox fa-3x mb-3 opacity-50" />
                  <p>No vehicles found</p>
                  <Link to="/app/vehicles/new" className="btn btn-warning btn-sm">
                    Add First Vehicle
                  </Link>
                </div>
              ) : (
                <Table responsive striped className="mb-0">
                  <thead>
                    <tr>
                      <th>Registration</th>
                      <th>Make/Model</th>
                      <th>Class</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVehicles.map(vehicle => (
                      <tr key={vehicle.vehicle_id}>
                        <td>
                          <Link to={`/app/vehicles/${vehicle.vehicle_id}/edit`}>
                            {vehicle.registration_no}
                          </Link>
                        </td>
                        <td>{vehicle.make} {vehicle.model}</td>
                        <td>
                          <Badge color="info">{vehicle.class}</Badge>
                        </td>
                        <td>
                          <Badge color={vehicle.is_active ? 'success' : 'secondary'}>
                            {vehicle.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Widget>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Row>
          <Col lg={12}>
            <Widget title={<h5 className="mt-0"><i className="fa fa-bolt mr-xs" /> Quick Actions</h5>}>
              <Row>
                <Col md={3} sm={6} xs={12} className="mb-3">
                  <Card className="text-center border-success">
                    <CardBody>
                      <i className="fa fa-user-plus fa-3x text-success mb-3" />
                      <h6>Add New Driver</h6>
                      <Link to="/app/drivers/new" className="btn btn-success btn-sm mt-2">
                        Create Driver
                      </Link>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={3} sm={6} xs={12} className="mb-3">
                  <Card className="text-center border-warning">
                    <CardBody>
                      <i className="fa fa-truck fa-3x text-warning mb-3" />
                      <h6>Add New Vehicle</h6>
                      <Link to="/app/drivers/new" className="btn btn-warning btn-sm mt-2">
                        Create Vehicle
                      </Link>
                      <small className="d-block mt-2 text-muted">
                        (via Driver Creation)
                      </small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={3} sm={6} xs={12} className="mb-3">
                  <Card className="text-center border-info">
                    <CardBody>
                      <i className="fa fa-search fa-3x text-info mb-3" />
                      <h6>Search Trips</h6>
                      <Link to="/app/trips" className="btn btn-info btn-sm mt-2">
                        Find Trip
                      </Link>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={3} sm={6} xs={12} className="mb-3">
                  <Card className="text-center border-danger">
                    <CardBody>
                      <i className="fa fa-list fa-3x text-danger mb-3" />
                      <h6>View All Data</h6>
                      <Link to="/app/drivers" className="btn btn-danger btn-sm mt-2">
                        View Reports
                      </Link>
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            </Widget>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    drivers: state.drivers.drivers || [],
    vehicles: state.vehicles.vehicles || [],
    isFetchingDrivers: state.drivers.isFetching || false,
    isFetchingVehicles: state.vehicles.isFetching || false,
  };
}

export default connect(mapStateToProps)(Dashboard);
