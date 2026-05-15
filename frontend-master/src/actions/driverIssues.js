import axios from 'axios';
import config from '../config';

export const FETCH_DRIVER_ISSUES_REQUEST = 'FETCH_DRIVER_ISSUES_REQUEST';
export const FETCH_DRIVER_ISSUES_SUCCESS = 'FETCH_DRIVER_ISSUES_SUCCESS';
export const FETCH_DRIVER_ISSUES_FAILURE = 'FETCH_DRIVER_ISSUES_FAILURE';

export const UPDATE_ISSUE_STATUS_REQUEST = 'UPDATE_ISSUE_STATUS_REQUEST';
export const UPDATE_ISSUE_STATUS_SUCCESS = 'UPDATE_ISSUE_STATUS_SUCCESS';
export const UPDATE_ISSUE_STATUS_FAILURE = 'UPDATE_ISSUE_STATUS_FAILURE';

export const FETCH_ISSUES_COUNT_SUCCESS = 'FETCH_ISSUES_COUNT_SUCCESS';

export const FETCH_ONBOARDING_ALERTS_REQUEST = 'FETCH_ONBOARDING_ALERTS_REQUEST';
export const FETCH_ONBOARDING_ALERTS_SUCCESS = 'FETCH_ONBOARDING_ALERTS_SUCCESS';
export const FETCH_ONBOARDING_ALERTS_FAILURE = 'FETCH_ONBOARDING_ALERTS_FAILURE';

export const FETCH_REJECTION_LOGS_REQUEST = 'FETCH_REJECTION_LOGS_REQUEST';
export const FETCH_REJECTION_LOGS_SUCCESS = 'FETCH_REJECTION_LOGS_SUCCESS';
export const FETCH_REJECTION_LOGS_FAILURE = 'FETCH_REJECTION_LOGS_FAILURE';

export const BLOCK_DRIVER_REQUEST = 'BLOCK_DRIVER_REQUEST';
export const BLOCK_DRIVER_SUCCESS = 'BLOCK_DRIVER_SUCCESS';
export const BLOCK_DRIVER_FAILURE = 'BLOCK_DRIVER_FAILURE';

const API_URL = config.opsApiBase;

const isWithinDateRange = (isoDate, startDate, endDate) => {
  if (!isoDate) return true;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return true;
  if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
  if (endDate && d > new Date(`${endDate}T23:59:59.999`)) return false;
  return true;
};

export async function fetchDriverEscalationSnapshot({ startDate, endDate, cities } = {}) {
  const cityList = Array.isArray(cities) ? cities.filter(Boolean) : [];
  const issuesParams = { status_filter: 'all' };
  if (cityList.length > 0) {
    issuesParams.cities = cityList.join(',');
  }

  const [issuesRes, alertsRes] = await Promise.all([
    axios.get(`${API_URL}/driver-issues`, { params: issuesParams }),
    axios.get(`${API_URL}/onboarding-alerts`, { params: { resolved: false } }),
  ]);

  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
  const alerts = Array.isArray(alertsRes.data?.alerts) ? alertsRes.data.alerts : [];

  const unresolvedIssues = issues.filter((i) => !['resolved', 'closed'].includes(i.ops_status));
  const datedIssues = unresolvedIssues.filter((i) => isWithinDateRange(i.created_at || i.reported_at || i.timestamp, startDate, endDate));
  const datedAlerts = alerts.filter((a) => isWithinDateRange(a.created_at, startDate, endDate));

  return {
    issues: datedIssues,
    alerts: datedAlerts,
    reportedCount: datedIssues.length + datedAlerts.length,
  };
}

// Fetch driver issues
export function fetchDriverIssues(statusFilter = 'reported', silent = false, cities = null) {
  return async (dispatch) => {
    if (!silent) {
      dispatch({ type: FETCH_DRIVER_ISSUES_REQUEST });
    }
    
    try {
      const params = { status_filter: statusFilter };
      
      // Add cities parameter if provided
      if (cities && cities.length > 0) {
        params.cities = cities.join(',');
      }
      
      const response = await axios.get(`${API_URL}/driver-issues`, { params });
      
      dispatch({
        type: FETCH_DRIVER_ISSUES_SUCCESS,
        payload: response.data
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching driver issues:', error);
      dispatch({
        type: FETCH_DRIVER_ISSUES_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch driver issues'
      });
      throw error;
    }
  };
}

// Update issue status
export function updateIssueStatus(issueId, newStatus) {
  return async (dispatch) => {
    dispatch({ type: UPDATE_ISSUE_STATUS_REQUEST });
    
    try {
      const response = await axios.put(`${API_URL}/driver-issues/${issueId}`, {
        ops_status: newStatus
      });
      
      dispatch({
        type: UPDATE_ISSUE_STATUS_SUCCESS,
        payload: { issueId, newStatus, response: response.data }
      });
      
      // Refresh the issues list after update
      dispatch(fetchDriverIssues('reported'));
      
      return response.data;
    } catch (error) {
      console.error('Error updating issue status:', error);
      dispatch({
        type: UPDATE_ISSUE_STATUS_FAILURE,
        payload: error.response?.data?.detail || 'Failed to update issue status'
      });
      throw error;
    }
  };
}

// Fetch count of reported issues (for badge)
export function fetchReportedIssuesCount() {
  return async (dispatch) => {
    try {
      let startDate, endDate;
      let selectedCities = [];
      
      try {
        const stored = localStorage.getItem('dateFilterRange');
        if (stored) {
          const range = JSON.parse(stored);
          startDate = range.startDate;
          endDate = range.endDate;
        }
        const storedCities = localStorage.getItem('selectedCities');
        if (storedCities) {
          const parsed = JSON.parse(storedCities);
          if (Array.isArray(parsed)) selectedCities = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse filters from localStorage', e);
      }

      const snapshot = await fetchDriverEscalationSnapshot({
        startDate,
        endDate,
        cities: selectedCities,
      });
      const count = snapshot.reportedCount;
      
      dispatch({
        type: FETCH_ISSUES_COUNT_SUCCESS,
        payload: count
      });
      return count;
    } catch (error) {
      console.error('Error fetching issues count:', error);
      return 0;
    }
  };
}

// Fetch onboarding alerts (missing documents during onboarding)
export function fetchOnboardingAlerts(resolved = null, silent = false) {
  return async (dispatch) => {
    if (!silent) {
      dispatch({ type: FETCH_ONBOARDING_ALERTS_REQUEST });
    }
    
    try {
      const params = {};
      if (resolved !== null) {
        params.resolved = resolved;
      }
      
      const response = await axios.get(`${API_URL}/onboarding-alerts`, { params });
      
      dispatch({
        type: FETCH_ONBOARDING_ALERTS_SUCCESS,
        payload: response.data.alerts || []
      });
      
      return response.data.alerts || [];
    } catch (error) {
      console.error('Error fetching onboarding alerts:', error);
      dispatch({
        type: FETCH_ONBOARDING_ALERTS_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch onboarding alerts'
      });
      return [];
    }
  };
}

// Fetch today's driver rejection logs
export function fetchRejectionLogs(silent = false) {
  return async (dispatch) => {
    if (!silent) {
      dispatch({ type: FETCH_REJECTION_LOGS_REQUEST });
    }
    
    try {
      const response = await axios.get(`${API_URL}/rejections/today`);
      
      dispatch({
        type: FETCH_REJECTION_LOGS_SUCCESS,
        payload: response.data.rejections || []
      });
      
      return response.data.rejections || [];
    } catch (error) {
      console.error('Error fetching rejection logs:', error);
      dispatch({
        type: FETCH_REJECTION_LOGS_FAILURE,
        payload: error.response?.data?.detail || 'Failed to fetch rejection logs'
      });
      return [];
    }
  };
}

// Block driver manually
export function blockDriver(driverId, blockedBy, blockedUntil, blockedReason) {
  return async (dispatch) => {
    dispatch({ type: BLOCK_DRIVER_REQUEST });
    
    try {
      const response = await axios.post(`${API_URL}/rejections/block`, {
        driver_id: driverId,
        blocked_by: blockedBy,
        blocked_until: blockedUntil,
        blocked_reason: blockedReason
      });
      
      dispatch({
        type: BLOCK_DRIVER_SUCCESS,
        payload: response.data
      });
      
      // Refresh rejection logs after blocking
      dispatch(fetchRejectionLogs(true));
      
      return response.data;
    } catch (error) {
      console.error('Error blocking driver:', error);
      dispatch({
        type: BLOCK_DRIVER_FAILURE,
        payload: error.response?.data?.detail || 'Failed to block driver'
      });
      throw error;
    }
  };
}
