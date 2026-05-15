import axios from 'axios';
import { toast } from 'react-toastify';
import config from '../config';

// Configure axios defaults
axios.defaults.baseURL = config.opsApiBase;

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Action types
export const FETCH_DRIVERS_REQUEST = 'FETCH_DRIVERS_REQUEST';
export const FETCH_DRIVERS_SUCCESS = 'FETCH_DRIVERS_SUCCESS';
export const FETCH_DRIVERS_FAILURE = 'FETCH_DRIVERS_FAILURE';

export const FETCH_DRIVER_REQUEST = 'FETCH_DRIVER_REQUEST';
export const FETCH_DRIVER_SUCCESS = 'FETCH_DRIVER_SUCCESS';
export const FETCH_DRIVER_FAILURE = 'FETCH_DRIVER_FAILURE';

export const CREATE_DRIVER_REQUEST = 'CREATE_DRIVER_REQUEST';
export const CREATE_DRIVER_SUCCESS = 'CREATE_DRIVER_SUCCESS';
export const CREATE_DRIVER_FAILURE = 'CREATE_DRIVER_FAILURE';

export const UPDATE_DRIVER_REQUEST = 'UPDATE_DRIVER_REQUEST';
export const UPDATE_DRIVER_SUCCESS = 'UPDATE_DRIVER_SUCCESS';
export const UPDATE_DRIVER_FAILURE = 'UPDATE_DRIVER_FAILURE';

export const DELETE_DRIVER_REQUEST = 'DELETE_DRIVER_REQUEST';
export const DELETE_DRIVER_SUCCESS = 'DELETE_DRIVER_SUCCESS';
export const DELETE_DRIVER_FAILURE = 'DELETE_DRIVER_FAILURE';

export const UPDATE_DRIVER_STATE_REQUEST = 'UPDATE_DRIVER_STATE_REQUEST';
export const UPDATE_DRIVER_STATE_SUCCESS = 'UPDATE_DRIVER_STATE_SUCCESS';
export const UPDATE_DRIVER_STATE_FAILURE = 'UPDATE_DRIVER_STATE_FAILURE';

// Action Creators
export function fetchDrivers() {
  return async (dispatch) => {
    dispatch({ type: FETCH_DRIVERS_REQUEST });
    
    try {
      // Note: baseURL already includes /api/v1/ops, so just use /drivers
      const response = await axios.get('/drivers');
      dispatch({
        type: FETCH_DRIVERS_SUCCESS,
        payload: response.data
      });
    } catch (error) {
      dispatch({
        type: FETCH_DRIVERS_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch drivers'
      });
      toast.error('Failed to fetch drivers');
    }
  };
}

export function fetchDriver(driverId) {
  return async (dispatch) => {
    dispatch({ type: FETCH_DRIVER_REQUEST });
    
    try {
      const response = await axios.get(`/drivers/${driverId}`);
      dispatch({
        type: FETCH_DRIVER_SUCCESS,
        payload: response.data
      });
      return response.data;
    } catch (error) {
      dispatch({
        type: FETCH_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch driver'
      });
      toast.error('Failed to fetch driver details');
      throw error;
    }
  };
}

export function createDriver(driverData) {
  return async (dispatch) => {
    dispatch({ type: CREATE_DRIVER_REQUEST });
    
    try {
      // Check if vehicle data is included - use new combined endpoint
      const hasVehicleData = driverData.registration_no && driverData.make && driverData.model && driverData.vehicle_class;
      const endpoint = hasVehicleData ? '/drivers/with-vehicle' : '/drivers';
      
      const response = await axios.post(endpoint, driverData);
      dispatch({
        type: CREATE_DRIVER_SUCCESS,
        payload: response.data
      });
      
      if (hasVehicleData) {
        toast.success('Driver and vehicle created successfully!');
      } else {
        toast.success('Driver created successfully!');
      }
      
      return response.data;
    } catch (error) {
      dispatch({
        type: CREATE_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to create driver'
      });
      toast.error(error.response?.data?.detail || 'Failed to create driver');
      throw error;
    }
  };
}

export function updateDriver(driverId, driverData) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_DRIVER_REQUEST });
    
    try {
      const response = await axios.put(`/drivers/${driverId}`, driverData);
      dispatch({
        type: UPDATE_DRIVER_SUCCESS,
        payload: { id: driverId, ...response.data }
      });
      toast.success('Driver updated successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: UPDATE_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update driver'
      });
      toast.error('Failed to update driver');
      throw error;
    }
  };
}

export function updateDriverState(driverId, state) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_DRIVER_STATE_REQUEST });
    
    try {
      const response = await axios.put(`/drivers/${driverId}/state`, null, {
        params: { state }
      });
      dispatch({
        type: UPDATE_DRIVER_STATE_SUCCESS,
        payload: { id: driverId, state }
      });
      toast.success('Driver state updated successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: UPDATE_DRIVER_STATE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update driver state'
      });
      toast.error('Failed to update driver state');
      throw error;
    }
  };
}

export function deleteDriver(driverId) {
  return async (dispatch) => {
    dispatch({ type: DELETE_DRIVER_REQUEST });
    
    try {
      await axios.delete(`/drivers/${driverId}`);
      dispatch({
        type: DELETE_DRIVER_SUCCESS,
        payload: driverId
      });
      toast.success('Driver deleted successfully!');
    } catch (error) {
      dispatch({
        type: DELETE_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to delete driver'
      });
      toast.error('Failed to delete driver');
      throw error;
    }
  };
}