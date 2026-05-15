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
export const FETCH_VEHICLES_REQUEST = 'FETCH_VEHICLES_REQUEST';
export const FETCH_VEHICLES_SUCCESS = 'FETCH_VEHICLES_SUCCESS';
export const FETCH_VEHICLES_FAILURE = 'FETCH_VEHICLES_FAILURE';

export const FETCH_VEHICLE_REQUEST = 'FETCH_VEHICLE_REQUEST';
export const FETCH_VEHICLE_SUCCESS = 'FETCH_VEHICLE_SUCCESS';
export const FETCH_VEHICLE_FAILURE = 'FETCH_VEHICLE_FAILURE';

export const CREATE_VEHICLE_REQUEST = 'CREATE_VEHICLE_REQUEST';
export const CREATE_VEHICLE_SUCCESS = 'CREATE_VEHICLE_SUCCESS';
export const CREATE_VEHICLE_FAILURE = 'CREATE_VEHICLE_FAILURE';

export const UPDATE_VEHICLE_REQUEST = 'UPDATE_VEHICLE_REQUEST';
export const UPDATE_VEHICLE_SUCCESS = 'UPDATE_VEHICLE_SUCCESS';
export const UPDATE_VEHICLE_FAILURE = 'UPDATE_VEHICLE_FAILURE';

export const DELETE_VEHICLE_REQUEST = 'DELETE_VEHICLE_REQUEST';
export const DELETE_VEHICLE_SUCCESS = 'DELETE_VEHICLE_SUCCESS';
export const DELETE_VEHICLE_FAILURE = 'DELETE_VEHICLE_FAILURE';

export const UPDATE_VEHICLE_STATE_REQUEST = 'UPDATE_VEHICLE_STATE_REQUEST';
export const UPDATE_VEHICLE_STATE_SUCCESS = 'UPDATE_VEHICLE_STATE_SUCCESS';
export const UPDATE_VEHICLE_STATE_FAILURE = 'UPDATE_VEHICLE_STATE_FAILURE';

// Action Creators
export function fetchVehicles() {
  return async (dispatch) => {
    dispatch({ type: FETCH_VEHICLES_REQUEST });
    
    try {
      const response = await axios.get('/vehicles');
      dispatch({
        type: FETCH_VEHICLES_SUCCESS,
        payload: response.data
      });
    } catch (error) {
      dispatch({
        type: FETCH_VEHICLES_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch vehicles'
      });
      toast.error('Failed to fetch vehicles');
    }
  };
}

export function fetchVehicle(vehicleId) {
  return async (dispatch) => {
    dispatch({ type: FETCH_VEHICLE_REQUEST });
    
    try {
      const response = await axios.get(`/vehicles/${vehicleId}`);
      dispatch({
        type: FETCH_VEHICLE_SUCCESS,
        payload: response.data
      });
      return response.data;
    } catch (error) {
      dispatch({
        type: FETCH_VEHICLE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch vehicle'
      });
      toast.error('Failed to fetch vehicle details');
      throw error;
    }
  };
}

export function createVehicle(vehicleData) {
  return async (dispatch) => {
    dispatch({ type: CREATE_VEHICLE_REQUEST });
    
    try {
      const response = await axios.post('/vehicles', vehicleData);
      dispatch({
        type: CREATE_VEHICLE_SUCCESS,
        payload: response.data
      });
      toast.success('Vehicle created successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: CREATE_VEHICLE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to create vehicle'
      });
      toast.error('Failed to create vehicle');
      throw error;
    }
  };
}

export function updateVehicle(vehicleId, vehicleData) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_VEHICLE_REQUEST });
    
    try {
      const response = await axios.put(`/vehicles/${vehicleId}`, vehicleData);
      dispatch({
        type: UPDATE_VEHICLE_SUCCESS,
        payload: { id: vehicleId, ...response.data }
      });
      toast.success('Vehicle updated successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: UPDATE_VEHICLE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update vehicle'
      });
      toast.error('Failed to update vehicle');
      throw error;
    }
  };
}

export function updateVehicleState(vehicleId, state) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_VEHICLE_STATE_REQUEST });
    
    try {
      const response = await axios.put(`/vehicles/${vehicleId}/state`, null, {
        params: { state }
      });
      dispatch({
        type: UPDATE_VEHICLE_STATE_SUCCESS,
        payload: { id: vehicleId, state }
      });
      toast.success('Vehicle state updated successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: UPDATE_VEHICLE_STATE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update vehicle state'
      });
      toast.error('Failed to update vehicle state');
      throw error;
    }
  };
}

export function deleteVehicle(vehicleId) {
  return async (dispatch) => {
    dispatch({ type: DELETE_VEHICLE_REQUEST });
    
    try {
      await axios.delete(`/vehicles/${vehicleId}`);
      dispatch({
        type: DELETE_VEHICLE_SUCCESS,
        payload: vehicleId
      });
      toast.success('Vehicle deleted successfully!');
    } catch (error) {
      dispatch({
        type: DELETE_VEHICLE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to delete vehicle'
      });
      toast.error('Failed to delete vehicle');
      throw error;
    }
  };
}
