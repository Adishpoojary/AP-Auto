import {
  FETCH_TRIP_REQUEST,
  FETCH_TRIP_SUCCESS,
  FETCH_TRIP_FAILURE,
  UPDATE_TRIP_STATE_REQUEST,
  UPDATE_TRIP_STATE_SUCCESS,
  UPDATE_TRIP_STATE_FAILURE,
  REASSIGN_DRIVER_REQUEST,
  REASSIGN_DRIVER_SUCCESS,
  REASSIGN_DRIVER_FAILURE,
} from '../actions/trips';

const initialState = {
  currentTrip: null,
  isFetching: false,
  isUpdating: false,
  error: null,
};

export default function tripsReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch Trip
    case FETCH_TRIP_REQUEST:
      return {
        ...state,
        isFetching: true,
        error: null,
      };
    case FETCH_TRIP_SUCCESS:
      return {
        ...state,
        isFetching: false,
        currentTrip: action.payload,
        error: null,
      };
    case FETCH_TRIP_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: action.payload,
      };

    // Update Trip State
    case UPDATE_TRIP_STATE_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case UPDATE_TRIP_STATE_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        currentTrip: action.payload,
        error: null,
      };
    case UPDATE_TRIP_STATE_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    // Reassign Driver
    case REASSIGN_DRIVER_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case REASSIGN_DRIVER_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        currentTrip: action.payload,
        error: null,
      };
    case REASSIGN_DRIVER_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
