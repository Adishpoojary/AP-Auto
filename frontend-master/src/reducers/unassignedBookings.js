import {
  FETCH_UNASSIGNED_COUNT_SUCCESS,
  UPDATE_UNASSIGNED_COUNT
} from '../actions/unassignedBookings';

const initialState = {
  unassignedCount: null
};

export default function unassignedBookingsReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_UNASSIGNED_COUNT_SUCCESS:
    case UPDATE_UNASSIGNED_COUNT:
      return {
        ...state,
        unassignedCount: action.payload
      };
    
    default:
      return state;
  }
}
