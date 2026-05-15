import {
  FETCH_DRIVER_ISSUES_REQUEST,
  FETCH_DRIVER_ISSUES_SUCCESS,
  FETCH_DRIVER_ISSUES_FAILURE,
  UPDATE_ISSUE_STATUS_REQUEST,
  UPDATE_ISSUE_STATUS_SUCCESS,
  UPDATE_ISSUE_STATUS_FAILURE,
  FETCH_ISSUES_COUNT_SUCCESS,
  FETCH_ONBOARDING_ALERTS_REQUEST,
  FETCH_ONBOARDING_ALERTS_SUCCESS,
  FETCH_ONBOARDING_ALERTS_FAILURE,
  FETCH_REJECTION_LOGS_REQUEST,
  FETCH_REJECTION_LOGS_SUCCESS,
  FETCH_REJECTION_LOGS_FAILURE,
  BLOCK_DRIVER_REQUEST,
  BLOCK_DRIVER_SUCCESS,
  BLOCK_DRIVER_FAILURE
} from '../actions/driverIssues';

const initialState = {
  issues: [],
  loading: false,
  error: null,
  updating: false,
  updateError: null,
  reportedCount: 0,
  onboardingAlerts: [],
  alertsLoading: false,
  alertsError: null,
  rejectionLogs: [],
  rejectionsLoading: false,
  rejectionsError: null,
  blocking: false,
  blockError: null
};

export default function driverIssuesReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_DRIVER_ISSUES_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    
    case FETCH_DRIVER_ISSUES_SUCCESS:
      return {
        ...state,
        loading: false,
        issues: action.payload,
        error: null
      };
    
    case FETCH_DRIVER_ISSUES_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    
    case UPDATE_ISSUE_STATUS_REQUEST:
      return {
        ...state,
        updating: true,
        updateError: null
      };
    
    case UPDATE_ISSUE_STATUS_SUCCESS:
      return {
        ...state,
        updating: false,
        updateError: null,
        // Update the specific issue in the list
        issues: state.issues.map(issue =>
          issue.id === action.payload.issueId
            ? { ...issue, ops_status: action.payload.newStatus }
            : issue
        )
      };
    
    case UPDATE_ISSUE_STATUS_FAILURE:
      return {
        ...state,
        updating: false,
        updateError: action.payload
      };
    
    case FETCH_ISSUES_COUNT_SUCCESS:
      return {
        ...state,
        reportedCount: action.payload
      };
    
    case FETCH_ONBOARDING_ALERTS_REQUEST:
      return {
        ...state,
        alertsLoading: true,
        alertsError: null
      };
    
    case FETCH_ONBOARDING_ALERTS_SUCCESS:
      return {
        ...state,
        alertsLoading: false,
        onboardingAlerts: action.payload,
        alertsError: null
      };
    
    case FETCH_ONBOARDING_ALERTS_FAILURE:
      return {
        ...state,
        alertsLoading: false,
        alertsError: action.payload
      };
    
    case FETCH_REJECTION_LOGS_REQUEST:
      return {
        ...state,
        rejectionsLoading: true,
        rejectionsError: null
      };
    
    case FETCH_REJECTION_LOGS_SUCCESS:
      return {
        ...state,
        rejectionsLoading: false,
        rejectionLogs: action.payload,
        rejectionsError: null,
        lastUpdated: new Date().toISOString()
      };
    
    case FETCH_REJECTION_LOGS_FAILURE:
      return {
        ...state,
        rejectionsLoading: false,
        rejectionsError: action.payload
      };
    
    case BLOCK_DRIVER_REQUEST:
      return {
        ...state,
        blocking: true,
        blockError: null
      };
    
    case BLOCK_DRIVER_SUCCESS:
      return {
        ...state,
        blocking: false,
        blockError: null
      };
    
    case BLOCK_DRIVER_FAILURE:
      return {
        ...state,
        blocking: false,
        blockError: action.payload
      };

    default:
      return state;
  }
}
