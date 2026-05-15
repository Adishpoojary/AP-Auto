import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import {
  Row,
  Col,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  Alert,
  Badge,
} from 'reactstrap';

import Widget from '../../../components/Widget';
import { fetchDriver, updateDriver } from '../../../actions/drivers';

class DriverEdit extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      formData: {
        license_number: '',
        license_expiry: '',
        language_preference: '',
        active_km_rate: '',
        dead_km_rate: '',
      },
      errors: {},
      isSubmitting: false,
      driver: null,
    };
  }

  async componentDidMount() {
    const driverId = this.props.match.params.id;
    try {
      const driver = await this.props.dispatch(fetchDriver(driverId));
      this.setState({
        driver,
        formData: {
          license_number: driver.license_number || '',
          license_expiry: driver.license_expiry || '',
          language_preference: driver.language_preference || '',
          active_km_rate: driver.active_km_rate || '',
          dead_km_rate: driver.dead_km_rate || '',
        }
      });
    } catch (error) {
      console.error('Failed to fetch driver:', error);
    }
  }

  handleInputChange = (e) => {
    const { name, value } = e.target;
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [name]: value
      },
      errors: {
        ...prevState.errors,
        [name]: null
      }
    }));
  }

  validateForm = () => {
    const { formData } = this.state;
    const errors = {};

    if (formData.license_expiry) {
      const expiryDate = new Date(formData.license_expiry);
      const today = new Date();
      if (expiryDate <= today) {
        errors.license_expiry = 'License expiry date must be in the future';
      }
    }

    if (formData.active_km_rate && (isNaN(formData.active_km_rate) || parseFloat(formData.active_km_rate) < 0)) {
      errors.active_km_rate = 'Active KM rate must be a valid positive number';
    }

    if (formData.dead_km_rate && (isNaN(formData.dead_km_rate) || parseFloat(formData.dead_km_rate) < 0)) {
      errors.dead_km_rate = 'Dead KM rate must be a valid positive number';
    }

    return errors;
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = this.validateForm();
    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    this.setState({ isSubmitting: true });

    try {
      const driverId = this.props.match.params.id;
      
      // Prepare data for API (only send non-empty values)
      const submitData = {};
      Object.keys(this.state.formData).forEach(key => {
        if (this.state.formData[key] !== '') {
          if (key === 'active_km_rate' || key === 'dead_km_rate') {
            submitData[key] = parseFloat(this.state.formData[key]);
          } else {
            submitData[key] = this.state.formData[key];
          }
        }
      });

      await this.props.dispatch(updateDriver(driverId, submitData));
      
      // Redirect to drivers list on success
      this.props.history.push('/app/drivers');
    } catch (error) {
      console.error('Failed to update driver:', error);
    } finally {
      this.setState({ isSubmitting: false });
    }
  }

  handleCancel = () => {
    this.props.history.push('/app/drivers');
  }

  render() {
    const { formData, errors, isSubmitting, driver } = this.state;
    const { isUpdating, isFetching, error } = this.props;

    if (isFetching) {
      return (
        <div>
          <Breadcrumb>
            <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
            <BreadcrumbItem><a href="#/app/drivers">Drivers</a></BreadcrumbItem>
            <BreadcrumbItem active>Edit Driver</BreadcrumbItem>
          </Breadcrumb>
          <div className="text-center">Loading driver details...</div>
        </div>
      );
    }

    if (!driver) {
      return (
        <div>
          <Breadcrumb>
            <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
            <BreadcrumbItem><a href="#/app/drivers">Drivers</a></BreadcrumbItem>
            <BreadcrumbItem active>Edit Driver</BreadcrumbItem>
          </Breadcrumb>
          <Alert color="danger">Driver not found</Alert>
        </div>
      );
    }

    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
          <BreadcrumbItem><a href="#/app/drivers">Drivers</a></BreadcrumbItem>
          <BreadcrumbItem active>Edit Driver</BreadcrumbItem>
        </Breadcrumb>
        
        <Row>
          <Col sm={8}>
            <Widget
              title={
                <h5 className="mt-0 mb-0">
                  <i className="fa fa-edit mr-xs opacity-70" />{' '}
                  Edit Driver: {driver.name}
                </h5>
              }
            >
              {error && (
                <Alert color="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              <Form onSubmit={this.handleSubmit}>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="license_number">License Number</Label>
                      <Input
                        type="text"
                        name="license_number"
                        id="license_number"
                        value={formData.license_number}
                        onChange={this.handleInputChange}
                        invalid={!!errors.license_number}
                        placeholder="KA20-2025-001"
                      />
                      {errors.license_number && <div className="invalid-feedback">{errors.license_number}</div>}
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="license_expiry">License Expiry Date</Label>
                      <Input
                        type="date"
                        name="license_expiry"
                        id="license_expiry"
                        value={formData.license_expiry}
                        onChange={this.handleInputChange}
                        invalid={!!errors.license_expiry}
                      />
                      {errors.license_expiry && <div className="invalid-feedback">{errors.license_expiry}</div>}
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="language_preference">Preferred Language</Label>
                      <Input
                        type="select"
                        name="language_preference"
                        id="language_preference"
                        value={formData.language_preference}
                        onChange={this.handleInputChange}
                      >
                        <option value="">Select Language</option>
                        <option value="english">English</option>
                        <option value="kannada">Kannada</option>
                        <option value="roman_kannada">Roman kannada</option>
                      </Input>
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="active_km_rate">Active KM Rate (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        name="active_km_rate"
                        id="active_km_rate"
                        value={formData.active_km_rate}
                        onChange={this.handleInputChange}
                        invalid={!!errors.active_km_rate}
                        placeholder="25.50"
                      />
                      {errors.active_km_rate && <div className="invalid-feedback">{errors.active_km_rate}</div>}
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label for="dead_km_rate">Dead KM Rate (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        name="dead_km_rate"
                        id="dead_km_rate"
                        value={formData.dead_km_rate}
                        onChange={this.handleInputChange}
                        invalid={!!errors.dead_km_rate}
                        placeholder="15.00"
                      />
                      {errors.dead_km_rate && <div className="invalid-feedback">{errors.dead_km_rate}</div>}
                    </FormGroup>
                  </Col>
                </Row>

                <FormGroup className="mt-4">
                  <Button 
                    type="submit" 
                    color="success" 
                    disabled={isSubmitting || isUpdating}
                    className="mr-2"
                  >
                    {isSubmitting || isUpdating ? 'Updating...' : 'Update Driver'}
                  </Button>
                  <Button 
                    type="button" 
                    color="default" 
                    onClick={this.handleCancel}
                    disabled={isSubmitting || isUpdating}
                  >
                    Cancel
                  </Button>
                </FormGroup>
              </Form>
            </Widget>
          </Col>
          <Col sm={4}>
            <Widget title="Driver Information">
              <div className="mb-2">
                <strong>Name:</strong> {driver.name}
              </div>
              <div className="mb-2">
                <strong>Phone:</strong> {driver.phone}
              </div>
              <div className="mb-2">
                <strong>Status:</strong>{' '}
                <Badge color={driver.status === 'active' ? 'success' : 'secondary'}>
                  {driver.status}
                </Badge>
              </div>
              <div className="mb-2">
                <strong>Verification:</strong>{' '}
                <Badge color={driver.verification_status === 'verified' ? 'success' : 'warning'}>
                  {driver.verification_status}
                </Badge>
              </div>
              {driver.total_trips !== undefined && (
                <div className="mb-2">
                  <strong>Total Trips:</strong> {driver.total_trips}
                </div>
              )}
              {driver.rating && (
                <div className="mb-2">
                  <strong>Rating:</strong> {driver.rating}/5
                </div>
              )}
            </Widget>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentDriver: state.drivers.currentDriver,
    isUpdating: state.drivers.isUpdating,
    isFetching: state.drivers.isFetching,
    error: state.drivers.error,
  };
}

export default withRouter(connect(mapStateToProps)(DriverEdit));