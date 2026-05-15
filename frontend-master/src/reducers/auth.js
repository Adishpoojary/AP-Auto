import {
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT_SUCCESS,
} from '../actions/user';

const token = localStorage.getItem('token') || localStorage.getItem('id_token');
export default function auth(state = {
  isFetching: false,
  isAuthenticated: !!token,
}, action) {
  switch (action.type) {
      case LOGIN_REQUEST:
          return Object.assign({}, state, {
              isFetching: true,
              isAuthenticated: false,
              errorMessage: '',
          });
      case LOGIN_SUCCESS:
          return Object.assign({}, state, {
              isFetching: false,
              isAuthenticated: true,
              errorMessage: '',
          });
      case LOGIN_FAILURE:
          return Object.assign({}, state, {
              isFetching: false,
              isAuthenticated: false,
              errorMessage: action.payload,
          });
      case LOGOUT_SUCCESS:
          return Object.assign({}, state, {
              isAuthenticated: false,
              errorMessage: '',
          });
      default:
          return state;
  }
}
