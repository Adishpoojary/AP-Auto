import axios from 'axios';
import config from '../config';

export const FETCH_UNLOCKED_COUNT_SUCCESS = 'FETCH_UNLOCKED_COUNT_SUCCESS';
export const UPDATE_UNLOCKED_COUNT = 'UPDATE_UNLOCKED_COUNT';

function readSelectedCitiesFromStorage() {
  try {
    const stored = localStorage.getItem('selectedCities');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

/** Sidebar + dashboard: same source as Unlocked Bookings page (city filter when set). */
export function fetchUnlockedBookingsCount() {
  return async (dispatch) => {
    try {
      const cities = readSelectedCitiesFromStorage();
      const params = {};
      if (cities.length > 0) {
        params.cities = cities.join(',');
      } else {
        params.count_only = true;
      }

      const res = await axios.get(`${config.dispatchApiUrl}/unlocked-bookings`, { params });

      if (!res.data?.success) {
        return null;
      }

      let count = typeof res.data.count === 'number' ? res.data.count : null;
      if (count == null && Array.isArray(res.data.data)) {
        count = res.data.data.length;
      }
      if (typeof count !== 'number' || !Number.isFinite(count)) {
        return null;
      }

      dispatch({
        type: FETCH_UNLOCKED_COUNT_SUCCESS,
        payload: count,
      });
      return count;
    } catch (error) {
      console.error('Error fetching unlocked bookings count:', error);
      return null;
    }
  };
}

export function updateUnlockedCount(count) {
  return {
    type: UPDATE_UNLOCKED_COUNT,
    payload: count,
  };
}
