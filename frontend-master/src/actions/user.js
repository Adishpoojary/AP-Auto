import axios from 'axios';
import config from '../config';

export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export const LOGIN_FAILURE = 'LOGIN_FAILURE';
export const LOGOUT_REQUEST = 'LOGOUT_REQUEST';
export const LOGOUT_SUCCESS = 'LOGOUT_SUCCESS';
export const LOGOUT_FAILURE = 'LOGOUT_FAILURE';

function requestLogin(creds) {
  return {
    type: LOGIN_REQUEST,
    isFetching: true,
    isAuthenticated: false,
    creds,
  };
}

export function receiveLogin(user) {
  return {
    type: LOGIN_SUCCESS,
    isFetching: false,
    isAuthenticated: true,
    id_token: user.id_token,
  };
}

function loginError(message) {
  return {
    type: LOGIN_FAILURE,
    isFetching: false,
    isAuthenticated: false,
    payload: message,
  };
}

function requestLogout() {
  return {
    type: LOGOUT_REQUEST,
    isFetching: true,
    isAuthenticated: true,
  };
}

export function receiveLogout() {
  return {
    type: LOGOUT_SUCCESS,
    isFetching: false,
    isAuthenticated: false,
  };
}

// Logs the user out
export function logoutUser() {
  return dispatch => {
    dispatch(requestLogout());
    localStorage.removeItem('id_token');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_role');
    document.cookie = 'id_token=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    dispatch(receiveLogout());
  };
}

export const loginUser = (userCredentials) => (dispatch) => {
  console.log('Attempting login with:', userCredentials);
  
  // Bypass authentication for testing
  if (userCredentials.login === 'ops' && userCredentials.password === 'password') {
    console.log('Login bypass successful');
    const mockToken = 'mock-jwt-token-for-testing';
    localStorage.setItem('token', mockToken);
    localStorage.setItem('username', userCredentials.login);
    localStorage.setItem('user_role', 'ops');
    const mockUserData = {
      id: 1,
      email: 'ops@company.com',
      name: 'Operations Manager',
      role: 'ops'
    };
    dispatch(receiveLogin(mockUserData));
    return Promise.resolve();
  } else {
    // For real authentication - send as form data
    const formData = new URLSearchParams();
    formData.append('username', userCredentials.login);
    formData.append('password', userCredentials.password);
    
    return axios.post('/api/v1/ops/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then(response => {
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('username', userCredentials.login);
      
      // Decode JWT to get role
      try {
        const tokenParts = access_token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        localStorage.setItem('user_role', payload.role || 'ops');
      } catch (e) {
        localStorage.setItem('user_role', 'ops');
      }
      
      dispatch(receiveLogin({ id_token: access_token }));
    }).catch(error => {
      console.error('Login error:', error);
      throw error;
    });
  }
};