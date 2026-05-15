import config from '../config';

export const FETCH_ESCALATION_COUNT_SUCCESS = 'FETCH_ESCALATION_COUNT_SUCCESS';
export const UPDATE_ESCALATION_COUNT = 'UPDATE_ESCALATION_COUNT';

// Fetch total trip escalation count (for sidebar badge)
export function fetchEscalationCount() {
  return async (dispatch) => {
    try {
      const response = await fetch(`${config.dispatchApiBase}/trip-escalations/stats`);
      const data = await response.json();
      const count = data?.stats?.total_escalations || 0;
      
      dispatch({
        type: FETCH_ESCALATION_COUNT_SUCCESS,
        payload: count
      });
      
      return count;
    } catch (error) {
      console.error('Error fetching escalation count:', error);
      return 0;
    }
  };
}

// Update count (e.g. from WebSocket or manual refresh)
export function updateEscalationCount(count) {
  return {
    type: UPDATE_ESCALATION_COUNT,
    payload: count
  };
}
