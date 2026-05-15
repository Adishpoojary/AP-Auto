import React, { createContext, useContext, useMemo } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import config from '../config';

const GOOGLE_MAPS_LIBRARIES = ['geometry', 'drawing'];
const GoogleMapsContext = createContext(null);

export const GoogleMapsProvider = ({ children }) => {
  const loader = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: config.googleMapsApiKey || process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const value = useMemo(() => loader, [loader]);
  return <GoogleMapsContext.Provider value={value}>{children}</GoogleMapsContext.Provider>;
};

export const useGoogleMaps = () => {
  const ctx = useContext(GoogleMapsContext);
  if (!ctx) throw new Error('useGoogleMaps must be used within GoogleMapsProvider');
  return ctx;
};
