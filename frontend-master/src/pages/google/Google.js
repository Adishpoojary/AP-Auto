import React from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from '../../context/GoogleMapsProvider';

import s from './Google.module.scss';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
  lat: -37.813179,
  lng: 144.950259,
};

function BasicMap() {
  const { isLoaded } = useGoogleMaps();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
    >
      <Marker position={center} />
    </GoogleMap>
  );
}

class Maps extends React.Component {

  render() {
    return (
      <div>
        <div className={s.MapContainer}>
          <BasicMap />
        </div>
      </div>
    );
  }
}

export default Maps;
