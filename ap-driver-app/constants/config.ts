/**
 * AP Autos Driver App - Configuration
 *
 * ====== HOW TO SWITCH FOR DEMO ======
 * Option 1 (Local WiFi): Set USE_NGROK = false, update LOCAL_IP to your current WiFi IP
 *   → Run `ipconfig` in PowerShell, look for "IPv4 Address" under WiFi adapter
 * Option 2 (ngrok / Any WiFi): Set USE_NGROK = true, paste your ngrok URL below
 *   → Run `ngrok http 8000` and copy the https URL
 */

// ===== TOGGLE THIS =====
const USE_NGROK = false;

// ===== UPDATE THESE =====
const LOCAL_IP = '192.168.1.103'; // Your current WiFi IP (run: ipconfig)
const NGROK_URL = 'https://YOUR-NGROK-URL.ngrok-free.app'; // Paste ngrok URL here

// ===== AUTO-CONFIGURED (don't touch) =====
const BASE_URL = USE_NGROK ? NGROK_URL : `http://${LOCAL_IP}:8000`;

export const Config = {
  API_URL: BASE_URL,
  API_PREFIX: '/api/v1',
  WS_URL: USE_NGROK
    ? NGROK_URL.replace('https', 'wss')
    : `ws://${LOCAL_IP}:8000`,

  // Google Maps
  GOOGLE_MAPS_API_KEY: 'AIzaSyCLCvKixHY5U3SocVQc2fjZtFlSGet-huI',

  // Location tracking
  LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds

  // Dev OTP
  DEV_OTP: '1234',
};

export default Config;
