// ==================== PRODUCTION CONFIGURATION ====================
// Centralized configuration for all backend API endpoints
// Update these URLs when deploying to production/staging environments

const config = {
  // Environment flag
  isBackend: true,

  // ==================== AP RIDES MONOLITH API ====================
  // All backend services now run on the single FastAPI Port 8000
  opsApiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  opsApiBase: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  
  dispatchApiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  dispatchApiBase: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  
  baseURLApi: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  
  customerApiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  customerApiBase: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  
  paymentApiBase: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',

  // ==================== WEBSOCKET URLS ====================
  websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000/ws',
  escalationWebsocket: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000/ws/ops',

  // ==================== GOOGLE MAPS ====================
  googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyCLCvKixHY5U3SocVQc2fjZtFlSGet-huI',

  // ==================== AUTH TOKEN ====================
  id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjpmYWxzZSwibG9naW4iOiJ1c2VyIiwiaWF0IjoxNTczNzQ4ODI1LCJleHAiOjE2MjA0MDQ4MjV9.Jd1Trqu6izHq2R3uw4enrDlQKG4mzZdipSMdYQD_9JM'
};

export default config;