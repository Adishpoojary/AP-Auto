import React from 'react';

/**
 * Returns a standardized display for a vehicle, including its registration number, class, and model.
 * Format:
 * Registration Number
 * Class X - Vehicle Model
 * 
 * @param {Object} vehicle - An object containing vehicle properties.
 * @returns {React.ReactNode} The formatted display.
 */
export const getVehicleDisplay = (vehicle) => {
    if (!vehicle) return '—';
    
    // Support common property names found across our backend payloads
    const regNo = vehicle.vehicle_number || vehicle.vehicle_registration || vehicle.registration_no || vehicle.vehicle_id || '—';
    const vehicleClass = vehicle.vehicle_class || vehicle.class || 'Unknown';
    const make = vehicle.vehicle_make || vehicle.make || '';
    const model = vehicle.vehicle_model || vehicle.model || vehicle.vehicle_name || 'Unknown';
    
    const classAndModel = `Class ${vehicleClass} - ${(make + ' ' + model).trim()}`;
    
    return (
        <div>
            <div className="font-weight-bold">{regNo}</div>
            <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{classAndModel}</div>
        </div>
    );
};
