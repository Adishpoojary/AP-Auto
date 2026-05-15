import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import ReduxThunk from 'redux-thunk';
import * as serviceWorker from './serviceWorker';
import axios from 'axios';

import App from './components/App';
import './styles/ap-autos-grand.css'; // Global Grand Override
import config from './config';
import reducers from './reducers';

axios.defaults.baseURL = config.baseURLApi;
axios.defaults.headers.common['Content-Type'] = "application/json";
axios.defaults.headers.common['ngrok-skip-browser-warning'] = "69420";
const token = localStorage.getItem('token') || localStorage.getItem('id_token');
if (token) {
    axios.defaults.headers.common['Authorization'] = "Bearer " + token;
}

const store = createStore(
  reducers,
  applyMiddleware(ReduxThunk)
);

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <Provider store={store}>
        <App />
    </Provider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
