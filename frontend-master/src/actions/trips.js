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
export const FETCH_TRIP_REQUEST = 'FETCH_TRIP_REQUEST';
export const FETCH_TRIP_SUCCESS = 'FETCH_TRIP_SUCCESS';
export const FETCH_TRIP_FAILURE = 'FETCH_TRIP_FAILURE';

export const UPDATE_TRIP_STATE_REQUEST = 'UPDATE_TRIP_STATE_REQUEST';
export const UPDATE_TRIP_STATE_SUCCESS = 'UPDATE_TRIP_STATE_SUCCESS';
export const UPDATE_TRIP_STATE_FAILURE = 'UPDATE_TRIP_STATE_FAILURE';

export const REASSIGN_DRIVER_REQUEST = 'REASSIGN_DRIVER_REQUEST';
export const REASSIGN_DRIVER_SUCCESS = 'REASSIGN_DRIVER_SUCCESS';
export const REASSIGN_DRIVER_FAILURE = 'REASSIGN_DRIVER_FAILURE';

// Action Creators
export function fetchTrip(tripId) {
  return async (dispatch) => {
    dispatch({ type: FETCH_TRIP_REQUEST });
    
    try {
      const response = await axios.get(`/trips/${tripId}`);
      dispatch({
        type: FETCH_TRIP_SUCCESS,
        payload: response.data
      });
      return response.data;
    } catch (error) {
      dispatch({
        type: FETCH_TRIP_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch trip'
      });
      toast.error('Failed to fetch trip details');
      throw error;
    }
  };
}

export function updateTripState(bookingId, stateData) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_TRIP_STATE_REQUEST });
    
    try {
      const response = await axios.put(`/bookings/${bookingId}/state`, stateData);
      dispatch({
        type: UPDATE_TRIP_STATE_SUCCESS,
        payload: response.data
      });
      toast.success('Trip state updated successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: UPDATE_TRIP_STATE_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update trip state'
      });
      toast.error('Failed to update trip state');
      throw error;
    }
  };
}

export function reassignDriver(bookingId, reassignData) {
  return async (dispatch) => {
    dispatch({ type: REASSIGN_DRIVER_REQUEST });
    
    try {
      const response = await axios.put(`/bookings/${bookingId}/driver`, reassignData);
      dispatch({
        type: REASSIGN_DRIVER_SUCCESS,
        payload: response.data
      });
      toast.success('Driver reassigned successfully!');
      return response.data;
    } catch (error) {
      dispatch({
        type: REASSIGN_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to reassign driver'
      });
      toast.error('Failed to reassign driver');
      throw error;
    }
  };
}
