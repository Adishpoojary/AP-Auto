import React, { createContext, useContext, useState } from 'react';

const OpsMapStateContext = createContext();

export const OpsMapStateProvider = ({ children }) => {
    // Persist selected driver and booking
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // Persist map viewport (center and zoom)
    const [mapViewport, setMapViewport] = useState(null);

    return (
        <OpsMapStateContext.Provider value={{
            selectedDriver, setSelectedDriver,
            selectedBooking, setSelectedBooking,
            mapViewport, setMapViewport
        }}>
            {children}
        </OpsMapStateContext.Provider>
    );
};

export const useOpsMapState = () => {
    return useContext(OpsMapStateContext);
};
