import {
  FETCH_UNLOCKED_COUNT_SUCCESS,
  UPDATE_UNLOCKED_COUNT,
} from '../actions/unlockedBookings';

const initialState = {
  unlockedCount: null,
};

export default function unlockedBookingsReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_UNLOCKED_COUNT_SUCCESS:
    case UPDATE_UNLOCKED_COUNT:
      return {
        ...state,
        unlockedCount: action.payload,
      };
    default:
      return state;
  }
}
