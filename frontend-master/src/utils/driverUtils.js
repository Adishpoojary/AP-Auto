/**
 * Utility functions for driver and vehicle formatting.
 */

/**
 * Returns a standardized display string for a driver and their vehicle.
 * Format: "Driver Name (Vehicle ID)"
 * 
 * @param {Object} item - An object containing driver and vehicle properties.
 * @returns {string} The formatted string to display.
 */
export const getDriverDisplay = (item) => {
    if (!item) return 'Unknown';
    
    const name = item.driver_name || item.name || 'Unknown';
    const vId = item.vehicle_id;
    
    if (vId !== undefined && vId !== null && vId !== '') {
        return `${name} (${vId})`;
    }
    
    return name;
};
