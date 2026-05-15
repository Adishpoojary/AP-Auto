import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Row,
  Col,
  Table,
  Button,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  Input,
  InputGroup,
  InputGroupAddon,
  ButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';

import Widget from '../../../components/Widget';
import { fetchDrivers, deleteDriver, updateDriverState } from '../../../actions/drivers';

class DriverList extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      searchTerm: '',
      statusFilter: 'all',
      dropdownOpen: {},
    };
  }

  componentDidMount() {
    this.props.dispatch(fetchDrivers());
  }

  toggleDropdown = (driverId) => {
    this.setState(prevState => ({
      dropdownOpen: {
        ...prevState.dropdownOpen,
        [driverId]: !prevState.dropdownOpen[driverId]
      }
    }));
  }

  handleSearch = (e) => {
    this.setState({ searchTerm: e.target.value });
  }

  handleStatusFilter = (status) => {
    this.setState({ statusFilter: status });
  }

  handleDeleteDriver = async (driverId) => {
    if (window.confirm('Are you sure you want to delete this driver?')) {
      try {
        await this.props.dispatch(deleteDriver(driverId));
      } catch (error) {
        console.error('Failed to delete driver:', error);
      }
    }
  }

  handleUpdateDriverState = async (driverId, newState) => {
    try {
      await this.props.dispatch(updateDriverState(driverId, newState));
    } catch (error) {
      console.error('Failed to update driver state:', error);
    }
  }

  getStatusBadge = (status) => {
    const statusMap = {
      verified: 'success',
      pending: 'warning',
      manual_review_required: 'danger',
      active: 'success',
      inactive: 'secondary',
    };
    return statusMap[status] || 'secondary';
  }

  filterDrivers = (drivers) => {
    return drivers.filter(driver => {
      const matchesSearch = (driver.name || '').toLowerCase().includes(this.state.searchTerm.toLowerCase()) ||
                           (driver.phone || '').includes(this.state.searchTerm);
      
      // Determine driver status based on verification and blocking
      const driverStatus = driver.is_blocked ? 'inactive' : 'active';
      
      const matchesStatus = this.state.statusFilter === 'all' || 
                           driver.verification_status === this.state.statusFilter ||
                           driverStatus === this.state.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  render() {
    const { drivers = [], isFetching, error } = this.props;
    const filteredDrivers = this.filterDrivers(drivers);

    if (error) {
      return (
        <div>
          <Breadcrumb>
            <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
            <BreadcrumbItem active>Drivers</BreadcrumbItem>
          </Breadcrumb>
          
          <Row>
            <Col sm={12}>
              <Widget title="Driver Management">
                <div className="alert alert-danger">
                  Error loading drivers: {error}
                  <br />
                  <Button color="primary" onClick={() => this.props.dispatch(fetchDrivers())}>
                    Retry
                  </Button>
                </div>
              </Widget>
            </Col>
          </Row>
        </div>
      );
    }

    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
          <BreadcrumbItem active>Drivers</BreadcrumbItem>
        </Breadcrumb>
        
        <Row>
          <Col sm={12}>
            <Widget
              title={
                <div>
                  <div className="pull-right mt-n-xs">
                    <Link to="/app/drivers/new" className="btn btn-success btn-sm">
                      Add New Driver
                    </Link>
                  </div>
                  <h5 className="mt-0 mb-3">
                    <i className="fa fa-users mr-xs opacity-70" />{' '}
                    Driver Management
                  </h5>
                </div>
              }
            >
              <Row className="mb-3">
                <Col sm={6}>
                  <InputGroup>
                    <Input 
                      placeholder="Search drivers..." 
                      value={this.state.searchTerm}
                      onChange={this.handleSearch}
                    />
                    <InputGroupAddon addonType="append">
                      <Button color="default">
                        <i className="fa fa-search" />
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </Col>
                <Col sm={3}>
                  <ButtonDropdown 
                    isOpen={this.state.statusDropdownOpen} 
                    toggle={() => this.setState(prev => ({ statusDropdownOpen: !prev.statusDropdownOpen }))}
                  >
                    <DropdownToggle caret color="default">
                      Filter: {this.state.statusFilter === 'all' ? 'All Status' : this.state.statusFilter}
                    </DropdownToggle>
                    <DropdownMenu>
                      <DropdownItem onClick={() => this.handleStatusFilter('all')}>All Status</DropdownItem>
                      <DropdownItem onClick={() => this.handleStatusFilter('verified')}>Verified</DropdownItem>
                      <DropdownItem onClick={() => this.handleStatusFilter('pending')}>Pending</DropdownItem>
                      {/* <DropdownItem onClick={() => this.handleStatusFilter('active')}>Active</DropdownItem>
                      <DropdownItem onClick={() => this.handleStatusFilter('inactive')}>Inactive</DropdownItem> */}
                    </DropdownMenu>
                  </ButtonDropdown>
                </Col>
              </Row>

              <Table responsive striped>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>License</th>
                    {/* <th>Status</th> */}
                    <th>Verification</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.isFetching ? (
                    <tr>
                      <td colSpan="6" className="text-center">Loading drivers...</td>
                    </tr>
                  ) : filteredDrivers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center">No drivers found</td>
                    </tr>
                  ) : (
                    filteredDrivers.map(driver => {
                      const driverStatus = driver.is_blocked ? 'inactive' : 'active';
                      
                      return (
                        <tr key={driver.driver_id}>
                          <td>{driver.driver_id}</td>
                          <td>{driver.name}</td>
                          <td>{driver.phone}</td>
                          <td>{driver.license_number || 'N/A'}</td>
                          {/* <td>
                            <Badge color={this.getStatusBadge(driverStatus)}>
                              {driverStatus}
                            </Badge>
                          </td> */}
                          <td>
                            <Badge color={this.getStatusBadge(driver.verification_status)}>
                              {driver.verification_status}
                            </Badge>
                          </td>
                          <td>
                            <ButtonDropdown 
                              isOpen={this.state.dropdownOpen[driver.driver_id]} 
                              toggle={() => this.toggleDropdown(driver.driver_id)}
                              size="sm"
                            >
                              <DropdownToggle caret color="default" size="sm">
                                Actions
                              </DropdownToggle>
                              <DropdownMenu>
                                <DropdownItem tag={Link} to={`/app/drivers/${driver.driver_id}/edit`}>
                                  <i className="fa fa-edit mr-1" /> Edit
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem onClick={() => this.handleUpdateDriverState(driver.driver_id, 'verified')}>
                                  <i className="fa fa-check mr-1" /> Mark Verified
                                </DropdownItem>
                                <DropdownItem onClick={() => this.handleUpdateDriverState(driver.driver_id, 'pending')}>
                                  <i className="fa fa-clock-o mr-1" /> Mark Pending
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem 
                                  onClick={() => this.handleDeleteDriver(driver.driver_id)}
                                  className="text-danger"
                                >
                                  <i className="fa fa-trash mr-1" /> Delete
                                </DropdownItem>
                              </DropdownMenu>
                            </ButtonDropdown>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </Widget>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    drivers: state.drivers.drivers,
    isFetching: state.drivers.isFetching,
    error: state.drivers.error,
  };
}

export default connect(mapStateToProps)(DriverList);