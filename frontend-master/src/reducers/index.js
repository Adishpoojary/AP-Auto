import { combineReducers } from 'redux';
import auth from './auth';
import runtime from './runtime';
import navigation from './navigation';
import posts from './posts';
import drivers from './drivers';
import vehicles from './vehicles';
import trips from './trips';
import driverIssues from './driverIssues';
import unassignedBookings from './unassignedBookings';
import escalationCount from './escalationCount';
import unlockedBookings from './unlockedBookings';

export default combineReducers({
  auth,
  runtime,
  navigation,
  posts,
  drivers,
  vehicles,
  trips,
  driverIssues,
  unassignedBookings,
  escalationCount,
  unlockedBookings,
});
