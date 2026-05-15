import axios from 'axios';
import config from '../config';

export const FETCH_UNASSIGNED_COUNT_SUCCESS = 'FETCH_UNASSIGNED_COUNT_SUCCESS';
export const UPDATE_UNASSIGNED_COUNT = 'UPDATE_UNASSIGNED_COUNT';

const UNASSIGNED_PANEL_LIMIT = 100;

// Fetch count of unassigned bookings (for badge)
export function fetchUnassignedBookingsCount() {
  return async (dispatch) => {
    try {
      const params = new URLSearchParams({
        filter: 'unassigned',
        use_live: 'true',
        limit: String(UNASSIGNED_PANEL_LIMIT),
      });
      const response = await axios.get(
        `${config.dispatchApiUrl}/dashboard/panel-overview?${params.toString()}`
      );
      const count = Number.isFinite(Number(response.data?.count))
        ? Number(response.data.count)
        : Array.isArray(response.data?.data)
          ? response.data.data.length
          : 0;

      dispatch({
        type: FETCH_UNASSIGNED_COUNT_SUCCESS,
        payload: count
      });

      return count;
    } catch (error) {
      console.error('Error fetching unassigned bookings count:', error);
      return 0;
    }
  };
}

// Update count from WebSocket (real-time)
export function updateUnassignedCount(count) {
  return {
    type: UPDATE_UNASSIGNED_COUNT,
    payload: count
  };
}
