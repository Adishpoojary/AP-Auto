import {
  FETCH_VEHICLES_REQUEST,
  FETCH_VEHICLES_SUCCESS,
  FETCH_VEHICLES_FAILURE,
  FETCH_VEHICLE_REQUEST,
  FETCH_VEHICLE_SUCCESS,
  FETCH_VEHICLE_FAILURE,
  CREATE_VEHICLE_REQUEST,
  CREATE_VEHICLE_SUCCESS,
  CREATE_VEHICLE_FAILURE,
  UPDATE_VEHICLE_REQUEST,
  UPDATE_VEHICLE_SUCCESS,
  UPDATE_VEHICLE_FAILURE,
  DELETE_VEHICLE_REQUEST,
  DELETE_VEHICLE_SUCCESS,
  DELETE_VEHICLE_FAILURE,
  UPDATE_VEHICLE_STATE_REQUEST,
  UPDATE_VEHICLE_STATE_SUCCESS,
  UPDATE_VEHICLE_STATE_FAILURE,
} from '../actions/vehicles';

const initialState = {
  vehicles: [],
  currentVehicle: null,
  isFetching: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

export default function vehiclesReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch Vehicles
    case FETCH_VEHICLES_REQUEST:
      return {
        ...state,
        isFetching: true,
        error: null,
      };
    case FETCH_VEHICLES_SUCCESS:
      return {
        ...state,
        isFetching: false,
        vehicles: action.payload.vehicles || action.payload,
        total: action.payload.total || action.payload.length,
        error: null,
      };
    case FETCH_VEHICLES_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: action.payload,
      };

    // Fetch Single Vehicle
    case FETCH_VEHICLE_REQUEST:
      return {
        ...state,
        isFetching: true,
        error: null,
      };
    case FETCH_VEHICLE_SUCCESS:
      return {
        ...state,
        isFetching: false,
        currentVehicle: action.payload,
        error: null,
      };
    case FETCH_VEHICLE_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: action.payload,
      };

    // Create Vehicle
    case CREATE_VEHICLE_REQUEST:
      return {
        ...state,
        isCreating: true,
        error: null,
      };
    case CREATE_VEHICLE_SUCCESS:
      return {
        ...state,
        isCreating: false,
        vehicles: [...state.vehicles, action.payload],
        error: null,
      };
    case CREATE_VEHICLE_FAILURE:
      return {
        ...state,
        isCreating: false,
        error: action.payload,
      };

    // Update Vehicle
    case UPDATE_VEHICLE_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case UPDATE_VEHICLE_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        vehicles: state.vehicles.map(vehicle =>
          vehicle.vehicle_id === action.payload.id ? { ...vehicle, ...action.payload } : vehicle
        ),
        currentVehicle: state.currentVehicle?.vehicle_id === action.payload.id 
          ? { ...state.currentVehicle, ...action.payload } 
          : state.currentVehicle,
        error: null,
      };
    case UPDATE_VEHICLE_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    // Update Vehicle State
    case UPDATE_VEHICLE_STATE_REQUEST:
      return {
        ...state,
        isUpdating: true,
        error: null,
      };
    case UPDATE_VEHICLE_STATE_SUCCESS:
      return {
        ...state,
        isUpdating: false,
        vehicles: state.vehicles.map(vehicle =>
          vehicle.vehicle_id === action.payload.id 
            ? { ...vehicle, status: action.payload.state, is_active: ['active', 'inactive'].includes(action.payload.state) }
            : vehicle
        ),
        currentVehicle: state.currentVehicle?.vehicle_id === action.payload.id 
          ? { ...state.currentVehicle, status: action.payload.state, is_active: ['active', 'inactive'].includes(action.payload.state) }
          : state.currentVehicle,
        error: null,
      };
    case UPDATE_VEHICLE_STATE_FAILURE:
      return {
        ...state,
        isUpdating: false,
        error: action.payload,
      };

    // Delete Vehicle
    case DELETE_VEHICLE_REQUEST:
      return {
        ...state,
        isDeleting: true,
        error: null,
      };
    case DELETE_VEHICLE_SUCCESS:
      return {
        ...state,
        isDeleting: false,
        vehicles: state.vehicles.filter(vehicle => vehicle.vehicle_id !== action.payload),
        currentVehicle: state.currentVehicle?.vehicle_id === action.payload ? null : state.currentVehicle,
        error: null,
      };
    case DELETE_VEHICLE_FAILURE:
      return {
        ...state,
        isDeleting: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
