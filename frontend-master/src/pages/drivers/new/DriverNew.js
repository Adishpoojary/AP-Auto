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
  Card,
  CardBody,
  CardTitle,
} from 'reactstrap';

import Widget from '../../../components/Widget';
import { createDriver } from '../../../actions/drivers';
import {
  getAllClasses,
  getVehicleNamesByClass
} from '../../../utils/vehicleDataLoader';

class DriverNew extends Component {
  constructor(props) {
    super(props);

    this.state = {
      formData: {
        // Driver details
        name: '',
        phone_number: '',
        license_number: '',
        license_expiry: '',
        preferred_lang: 'english',
        active_km_rate: '',
        dead_km_rate: '',
        // Vehicle details (MANDATORY)
        registration_no: '',
        make: '',
        model: '',
        vehicle_class: 1,
        vehicle_name: '', // Combined display name
        base_place: '', // New field for address/place
        base_lat: '',
        base_lng: '',
        resolved_address: '',
      },
      errors: {},
      isSubmitting: false,
      isGeocoding: false,
      availableClasses: [],
      availableVehicleNames: [], // Loaded based on selected class
      isLoadingVehicles: false,
    };
  }

  async componentDidMount() {
    // Load all available classes
    const classes = getAllClasses();
    this.setState({ availableClasses: classes });

    // Load vehicles for default class (1)
    await this.loadVehiclesForClass(1);
  }

  loadVehiclesForClass = async (classNumber) => {
    this.setState({ isLoadingVehicles: true });
    try {
      const vehicles = await getVehicleNamesByClass(classNumber);
      this.setState({
        availableVehicleNames: vehicles,
        isLoadingVehicles: false
      });
    } catch (error) {
      console.error('Error loading vehicles:', error);
      this.setState({
        availableVehicleNames: [],
        isLoadingVehicles: false
      });
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
        [name]: null // Clear error when user starts typing
      }
    }));
  }

  handleVehicleClassChange = async (e) => {
    const classNumber = parseInt(e.target.value);

    // Update class and clear vehicle selection
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        vehicle_class: classNumber,
        vehicle_name: '',
        make: '',
        model: ''
      },
      errors: {
        ...prevState.errors,
        vehicle_class: null
      }
    }));

    // Load vehicles for this class
    await this.loadVehiclesForClass(classNumber);
  }

  handleVehicleNameChange = (e) => {
    const selectedName = e.target.value;

    // Find the vehicle in available options
    const vehicle = this.state.availableVehicleNames.find(v => v.vehicle_name === selectedName);

    if (vehicle) {
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          vehicle_name: vehicle.vehicle_name,
          make: vehicle.make,
          model: vehicle.model
        },
        errors: {
          ...prevState.errors,
          vehicle_name: null,
          make: null,
          model: null
        }
      }));
    }
  }

  handleGeocodePlace = async () => {
    const { base_place } = this.state.formData;

    if (!base_place || !base_place.trim()) {
      this.setState(prevState => ({
        errors: {
          ...prevState.errors,
          base_place: 'Please enter a place/address first'
        }
      }));
      return;
    }

    this.setState({ isGeocoding: true });

    try {
      const GEOCODING_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(base_place)}&key=${GEOCODING_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const formatted_address = data.results[0].formatted_address;
        this.setState(prevState => ({
          formData: {
            ...prevState.formData,
            base_lat: location.lat.toString(),
            base_lng: location.lng.toString(),
            resolved_address: formatted_address
          },
          errors: {
            ...prevState.errors,
            base_place: null,
            base_lat: null,
            base_lng: null
          },
          isGeocoding: false
        }));
      } else {
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            base_place: 'Could not find location. Please try a different address.'
          },
          isGeocoding: false
        }));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.setState(prevState => ({
        errors: {
          ...prevState.errors,
          base_place: 'Failed to geocode address. Please try again.'
        },
        isGeocoding: false
      }));
    }
  }

  validateForm = () => {
    const { formData } = this.state;
    const errors = {};

    // Driver - Required field validation
    if (!formData.name.trim()) {
      errors.name = 'Driver name is required';
    }

    if (!formData.phone_number.trim()) {
      errors.phone_number = 'Phone number is required';
    } else if (!/^\+?\d{10,15}$/.test(formData.phone_number.replace(/[\s\-()]/g, ''))) {
      errors.phone_number = 'Enter valid phone number (10-15 digits, can include +)';
    }

    if (!formData.license_number.trim()) {
      errors.license_number = 'License number is required';
    }

    if (!formData.license_expiry) {
      errors.license_expiry = 'License expiry date is required';
    } else {
      const expiryDate = new Date(formData.license_expiry);
      const today = new Date();
      if (expiryDate <= today) {
        errors.license_expiry = 'License expiry date must be in the future';
      }
    }

    // Driver - Optional field validation
    if (formData.active_km_rate && (isNaN(formData.active_km_rate) || parseFloat(formData.active_km_rate) < 0)) {
      errors.active_km_rate = 'Active KM rate must be a valid positive number';
    }

    if (formData.dead_km_rate && (isNaN(formData.dead_km_rate) || parseFloat(formData.dead_km_rate) < 0)) {
      errors.dead_km_rate = 'Dead KM rate must be a valid positive number';
    }

    // Vehicle - Required field validation
    if (!formData.registration_no.trim()) {
      errors.registration_no = 'Vehicle registration number is required';
    }

    if (!formData.vehicle_name || !formData.vehicle_name.trim()) {
      errors.vehicle_name = 'Vehicle name is required - please select from dropdown';
    }

    if (!formData.make || !formData.make.trim()) {
      errors.make = 'Vehicle make is required - select vehicle name first';
    }

    if (!formData.model || !formData.model.trim()) {
      errors.model = 'Vehicle model is required - select vehicle name first';
    }

    if (!formData.vehicle_class || formData.vehicle_class < 1 || formData.vehicle_class > 12) {
      errors.vehicle_class = 'Valid vehicle class (1-12) is required';
    }

    // Base Location - Required field validation
    if (!formData.base_place || !formData.base_place.trim()) {
      errors.base_place = 'Base location place/address is required';
    }

    if (!formData.base_lat || formData.base_lat === '') {
      errors.base_lat = 'Base location latitude is required';
    } else if (isNaN(formData.base_lat) || parseFloat(formData.base_lat) < -90 || parseFloat(formData.base_lat) > 90) {
      errors.base_lat = 'Base latitude must be between -90 and 90';
    }

    if (!formData.base_lng || formData.base_lng === '') {
      errors.base_lng = 'Base location longitude is required';
    } else if (isNaN(formData.base_lng) || parseFloat(formData.base_lng) < -180 || parseFloat(formData.base_lng) > 180) {
      errors.base_lng = 'Base longitude must be between -180 and 180';
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
      // Prepare data for API - combined driver and vehicle
      const submitData = {
        // Driver fields
        name: this.state.formData.name,
        phone_number: this.state.formData.phone_number,
        license_number: this.state.formData.license_number,
        license_expiry: this.state.formData.license_expiry,
        preferred_lang: this.state.formData.preferred_lang,
        active_km_rate: this.state.formData.active_km_rate ? parseFloat(this.state.formData.active_km_rate) : null,
        dead_km_rate: this.state.formData.dead_km_rate ? parseFloat(this.state.formData.dead_km_rate) : null,
        // Vehicle fields
        registration_no: this.state.formData.registration_no,
        make: this.state.formData.make,
        model: this.state.formData.model,
        vehicle_class: parseInt(this.state.formData.vehicle_class),
        base_lat: this.state.formData.base_lat ? parseFloat(this.state.formData.base_lat) : null,
        base_lng: this.state.formData.base_lng ? parseFloat(this.state.formData.base_lng) : null,
      };

      await this.props.dispatch(createDriver(submitData));

      // Redirect to vehicle tracker page on success
      this.props.history.push('/app/dispatch/vehicles');
    } catch (error) {
      console.error('Failed to create driver with vehicle:', error);
    } finally {
      this.setState({ isSubmitting: false });
    }
  }

  handleCancel = () => {
    this.props.history.push('/app/dispatch/vehicles');
  }

  render() {
    const { formData, errors, isSubmitting } = this.state;
    const { isCreating, error } = this.props;

    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem>YOU ARE HERE</BreadcrumbItem>
          <BreadcrumbItem><a href="#/app/dispatch/vehicles">Vehicle Tracker</a></BreadcrumbItem>
          <BreadcrumbItem active>New Driver/Vehicle</BreadcrumbItem>
        </Breadcrumb>

        <Row>
          <Col sm={8}>
            <Widget
              title={
                <h5 className="mt-0 mb-0">
                  <i className="fa fa-user-plus mr-xs opacity-70" />{' '}
                  Add New Driver
                </h5>
              }
            >
              {error && (
                <Alert color="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              <Form onSubmit={this.handleSubmit}>
                {/* DRIVER INFORMATION SECTION */}
                <Card className="mb-4 border-success">
                  <CardBody>
                    <CardTitle tag="h6" className="text-success mb-3">
                      <i className="fa fa-user mr-2" />
                      Driver Information
                    </CardTitle>

                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label for="name">Driver Name *</Label>
                          <Input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={this.handleInputChange}
                            invalid={!!errors.name}
                            placeholder="Enter driver name"
                          />
                          {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup>
                          <Label for="phone_number">Phone Number *</Label>
                          <Input
                            type="tel"
                            name="phone_number"
                            id="phone_number"
                            value={formData.phone_number}
                            onChange={this.handleInputChange}
                            invalid={!!errors.phone_number}
                            placeholder="9876543210"
                          />
                          {errors.phone_number && <div className="invalid-feedback">{errors.phone_number}</div>}
                        </FormGroup>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label for="license_number">License Number *</Label>
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
                          <Label for="license_expiry">License Expiry Date *</Label>
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
                      <Col md={4}>
                        <FormGroup>
                          <Label for="preferred_lang">Preferred Language</Label>
                          <Input
                            type="select"
                            name="preferred_lang"
                            id="preferred_lang"
                            value={formData.preferred_lang}
                            onChange={this.handleInputChange}
                          >
                            <option value="english">English</option>
                            <option value="kannada">Kannada</option>
                            <option value="roman_kannada">Roman kannada</option>
                          </Input>
                        </FormGroup>
                      </Col>
                      <Col md={4}>
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
                      <Col md={4}>
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
                  </CardBody>
                </Card>

                {/* VEHICLE INFORMATION SECTION */}
                <Card className="mb-4 border-warning">
                  <CardBody>
                    <CardTitle tag="h6" className="text-warning mb-3">
                      <i className="fa fa-truck mr-2" />
                      Vehicle Information (Required)
                    </CardTitle>

                    <Row>
                      <Col md={12}>
                        <FormGroup>
                          <Label for="registration_no">Vehicle Registration Number *</Label>
                          <Input
                            type="text"
                            name="registration_no"
                            id="registration_no"
                            value={formData.registration_no}
                            onChange={this.handleInputChange}
                            invalid={!!errors.registration_no}
                            placeholder="e.g., KA01AB1234"
                          />
                          {errors.registration_no && <div className="invalid-feedback">{errors.registration_no}</div>}
                        </FormGroup>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={4}>
                        <FormGroup>
                          <Label for="vehicle_class">Vehicle Class *</Label>
                          <Input
                            type="select"
                            name="vehicle_class"
                            id="vehicle_class"
                            value={formData.vehicle_class}
                            onChange={this.handleVehicleClassChange}
                            invalid={!!errors.vehicle_class}
                          >
                            {this.state.availableClasses.map(cls => (
                              <option key={cls.value} value={cls.value}>
                                {cls.label}
                              </option>
                            ))}
                          </Input>
                          {errors.vehicle_class && <div className="invalid-feedback">{errors.vehicle_class}</div>}
                        </FormGroup>
                      </Col>
                      <Col md={8}>
                        <FormGroup>
                          <Label for="vehicle_name">Vehicle Name *</Label>
                          <Input
                            type="select"
                            name="vehicle_name"
                            id="vehicle_name"
                            value={formData.vehicle_name}
                            onChange={this.handleVehicleNameChange}
                            invalid={!!errors.vehicle_name || !!errors.make || !!errors.model}
                            disabled={this.state.isLoadingVehicles}
                          >
                            <option value="">
                              {this.state.isLoadingVehicles ? 'Loading vehicles...' : 'Select Vehicle'}
                            </option>
                            {this.state.availableVehicleNames.map((vehicle, index) => (
                              <option key={index} value={vehicle.vehicle_name}>
                                {vehicle.display}
                              </option>
                            ))}
                          </Input>
                          {(errors.vehicle_name || errors.make || errors.model) && (
                            <div className="invalid-feedback">
                              {errors.vehicle_name || errors.make || errors.model}
                            </div>
                          )}
                          <small className="form-text text-muted">
                            {formData.make && formData.model && (
                              <span className="text-success">
                                <i className="fa fa-check-circle mr-1" />
                                Make: <strong>{formData.make}</strong> | Model: <strong>{formData.model}</strong>
                              </span>
                            )}
                            {!formData.make && !formData.model && (
                              'Select vehicle from the dropdown (make and model will be auto-filled)'
                            )}
                          </small>
                        </FormGroup>
                      </Col>
                    </Row>

                    <h6 className="mb-3 mt-4 text-warning">
                      <i className="fa fa-map-marker mr-2" />
                      Base Location (Required)
                    </h6>

                    <Row>
                      <Col md={12}>
                        <FormGroup>
                          <Label for="base_place">
                            Place / Address *
                            <small className="text-muted ml-2">(Will auto-fill lat/lng)</small>
                          </Label>
                          <div className="d-flex">
                            <Input
                              type="text"
                              name="base_place"
                              id="base_place"
                              value={formData.base_place}
                              onChange={this.handleInputChange}
                              invalid={!!errors.base_place}
                              placeholder="e.g., Bangalore, Karnataka or MG Road, Bangalore"
                              className="mr-2"
                            />
                            <Button
                              type="button"
                              color="primary"
                              onClick={this.handleGeocodePlace}
                              disabled={this.state.isGeocoding || !formData.base_place}
                              style={{ minWidth: '140px' }}
                            >
                              {this.state.isGeocoding ? (
                                <>
                                  <i className="fa fa-spinner fa-spin mr-1" />
                                  Geocoding...
                                </>
                              ) : (
                                <>
                                  <i className="fa fa-map-pin mr-1" />
                                  Get Coordinates
                                </>
                              )}
                            </Button>
                          </div>
                          {errors.base_place && <div className="text-danger small mt-1">{errors.base_place}</div>}
                          {!errors.base_place && formData.base_lat && formData.base_lng && formData.resolved_address && (
                            <div className="mt-3" style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              background: '#ecfdf3',
                              color: '#065f46',
                              borderRadius: '8px',
                              fontWeight: '600',
                              fontSize: '13px'
                            }}>
                              <i className="fa fa-check-circle" />
                              Using address: {formData.resolved_address}
                            </div>
                          )}
                          {!errors.base_place && formData.base_lat && formData.base_lng && !formData.resolved_address && (
                            <small className="form-text text-success mt-2">
                              <i className="fa fa-check-circle mr-1" />
                              Coordinates auto-filled from address
                            </small>
                          )}
                        </FormGroup>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label for="base_lat">Base Location Latitude *</Label>
                          <Input
                            type="number"
                            step="0.000001"
                            name="base_lat"
                            id="base_lat"
                            value={formData.base_lat}
                            onChange={this.handleInputChange}
                            invalid={!!errors.base_lat}
                            placeholder="e.g., 12.9716"
                          />
                          {errors.base_lat && <div className="invalid-feedback">{errors.base_lat}</div>}
                          <small className="form-text text-muted">Auto-filled or enter manually</small>
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup>
                          <Label for="base_lng">Base Location Longitude *</Label>
                          <Input
                            type="number"
                            step="0.000001"
                            name="base_lng"
                            id="base_lng"
                            value={formData.base_lng}
                            onChange={this.handleInputChange}
                            invalid={!!errors.base_lng}
                            placeholder="e.g., 77.5946"
                          />
                          {errors.base_lng && <div className="invalid-feedback">{errors.base_lng}</div>}
                          <small className="form-text text-muted">Auto-filled or enter manually</small>
                        </FormGroup>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>

                <FormGroup className="mt-4">
                  <Button
                    type="submit"
                    color="success"
                    disabled={isSubmitting || isCreating}
                    className="mr-2"
                  >
                    {isSubmitting || isCreating ? 'Creating...' : 'Create Driver'}
                  </Button>
                  <Button
                    type="button"
                    color="default"
                    onClick={this.handleCancel}
                    disabled={isSubmitting || isCreating}
                  >
                    Cancel
                  </Button>
                </FormGroup>
              </Form>
            </Widget>
          </Col>
          <Col sm={4}>
            <Widget title="📋 Form Guide">
              <Alert color="info" className="fs-sm mb-3">
                <i className="fa fa-info-circle mr-2" />
                <strong>Note:</strong> Vehicle information is now <strong>mandatory</strong> when creating a driver!
              </Alert>

              <p className="fs-sm text-muted mb-2">
                <strong className="text-success">👤 Driver - Required:</strong>
              </p>
              <ul className="fs-sm text-muted mb-3">
                <li>Driver Name</li>
                <li>Phone Number</li>
                <li>License Number</li>
                <li>License Expiry Date</li>
              </ul>

              <p className="fs-sm text-muted mb-2">
                <strong className="text-warning">🚛 Vehicle - Required:</strong>
              </p>
              <ul className="fs-sm text-muted mb-3">
                <li>Registration Number</li>
                <li>Vehicle Class</li>
                <li>Make & Model (auto-filled)</li>
                <li>Base Location (Place/Address)</li>
                <li>Base Location (Lat/Lng)</li>
              </ul>

              <p className="fs-sm text-muted mb-2">
                <strong>Optional Fields:</strong>
              </p>
              <ul className="fs-sm text-muted">
                <li>Language Preference</li>
                <li>Active/Dead KM Rates</li>
              </ul>

              <Alert color="info" className="fs-sm mt-3">
                <i className="fa fa-lightbulb-o mr-2" />
                <strong>Tip:</strong> Enter the place/address and click "Get Coordinates" to auto-fill latitude and longitude!
              </Alert>
            </Widget>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    isCreating: state.drivers.isCreating,
    error: state.drivers.error,
  };
}

export default withRouter(connect(mapStateToProps)(DriverNew));