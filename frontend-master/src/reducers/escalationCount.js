import {
  FETCH_ESCALATION_COUNT_SUCCESS,
  UPDATE_ESCALATION_COUNT
} from '../actions/escalationCount';

const initialState = {
  escalationCount: 0
};

export default function escalationCountReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_ESCALATION_COUNT_SUCCESS:
    case UPDATE_ESCALATION_COUNT:
      return {
        ...state,
        escalationCount: action.payload
      };
    
    default:
      return state;
  }
}
