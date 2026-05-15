import {
  FETCH_DRIVERS_REQUEST,
  FETCH_DRIVERS_SUCCESS,
  FETCH_DRIVERS_FAILURE,
  FETCH_DRIVER_REQUEST,
  FETCH_DRIVER_SUCCESS,
  FETCH_DRIVER_FAILURE,
  CREATE_DRIVER_REQUEST,
  CREATE_DRIVER_SUCCESS,
  CREATE_DRIVER_FAILURE,
  UPDATE_DRIVER_REQUEST,
  UPDATE_DRIVER_SUCCESS,
  UPDATE_DRIVER_FAILURE,
  DELETE_DRIVER_REQUEST,
  DELETE_DRIVER_SUCCESS,
  DELETE_DRIVER_FAILURE,
  UPDATE_DRIVER_STATE_REQUEST,
  UPDATE_DRIVER_STATE_SUCCESS,
  UPDATE_DRIVER_STATE_FAILURE,
} from '../actions/drivers';

const initialState = {
  drivers: [],
  currentDriver: null,
  isFetching: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

export default function driversReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch Drivers
    case FETCH_DRIVERS_REQUEST:
      return {
        ...state,
        isFetching: true,
        error: null,
      };
    case FETCH_DRIVERS_SUCCESS:
      return {
        ...state,
        isFetching: false,
        drivers: action.payload.drivers || action.payload, // Handle both {drivers: [...]} and [...] response formats
        total: action.payload.total || action.payload.length,
        error: null,
      };
    case FETCH_DRIVERS_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: action.payload,
      };

    // Fetch Single Driver
    case FETCH_DRIVER_REQUEST:
      return {
        ...state,
        isFetching: true,
        error: null,
      };
    case FETCH_DRIVER_SUCCESS:
      return {
        ...state,
        isFetching: false,
        currentDriver: action.payload,
        error: null,
      };
    case FETCH_DRIVER_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: action.payload,
      };

    // Create Driver
    case CREATE_DRIVER_REQUEST:
      return {
        ...state,
        isCreating: true,
        error: null,
      };
    case CREATE_DRIVER_SUCCESS:
      return {
        ...state,
        isCreating: false,
        drivers: [...state.drivers, action.payload],
        error: null,
      };
    case CREATE_DRIVER_FAILURE:
      return {
        ...state,
        isCreating: false,
        error: action.payload,
      };

    // Update Driver
    case UPDATE_DRIVER_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case UPDATE_DRIVER_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        drivers: state.drivers.map(driver =>
          driver.driver_id === action.payload.id ? { ...driver, ...action.payload } : driver
        ),
        currentDriver: state.currentDriver?.driver_id === action.payload.id 
          ? { ...state.currentDriver, ...action.payload } 
          : state.currentDriver,
        error: null,
      };
    case UPDATE_DRIVER_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    // Update Driver State
    case UPDATE_DRIVER_STATE_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case UPDATE_DRIVER_STATE_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        drivers: state.drivers.map(driver =>
          driver.driver_id === action.payload.id 
            ? { ...driver, verification_status: action.payload.state, status: action.payload.state }
            : driver
        ),
        currentDriver: state.currentDriver?.driver_id === action.payload.id 
          ? { ...state.currentDriver, verification_status: action.payload.state, status: action.payload.state }
          : state.currentDriver,
        error: null,
      };
    case UPDATE_DRIVER_STATE_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    // Delete Driver
    case DELETE_DRIVER_REQUEST:
      return {
        ...state,
        isDeleting: true,
        error: null,
      };
    case DELETE_DRIVER_SUCCESS:
      return {
        ...state,
        isDeleting: false,
        drivers: state.drivers.filter(driver => driver.driver_id !== action.payload),
        currentDriver: state.currentDriver?.driver_id === action.payload ? null : state.currentDriver,
        error: null,
      };
    case DELETE_DRIVER_FAILURE:
      return {
        ...state,
        isDeleting: false,
        error: action.payload,
      };

    default:
      return state;
  }
}