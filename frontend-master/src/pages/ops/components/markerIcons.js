/**
 * Custom Map Marker Icons for Ops Dashboard
 * 
 * This module provides SVG-based marker icons for the Google Maps integration.
 * - Driver markers: Car icons with status-based colors
 * - Booking markers: Pickup pin icons
 * 
 * All icons are optimized SVG paths for performance and scalability.
 */

/**
 * Generate a car icon for driver markers
 * @param {string} status - Driver status: 'active', 'available', 'inactive', etc.
 * @returns {object} Google Maps marker icon configuration
 */
export const getDriverIcon = (status = 'available') => {
    // Color mapping based on driver status
    const colorMap = {
        active: '#3B82F6',      // Blue - on trip (flowing, no action needed)
        available: '#10B981',   // Green - available (idle, ready for assignment)
        inactive: '#F59E0B',    // Orange - inactive/offline (at base)
        default: '#9CA3AF'      // Light gray - unknown status
    };

    const fillColor = colorMap[status] || colorMap.default;

    // Modern car icon SVG path (top-down view)
    return {
        // Truck SVG Path
        path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-8.5l1.96 2.5H17V9.5h2.5zM18 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z',
        fillColor: fillColor,
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: '#1a1a1a',
        scale: 1.2,
        anchor: { x: 12, y: 12 },
        labelOrigin: { x: 12, y: 12 }
    };
};

/**
 * Generate a pickup pin icon for booking markers
 * @param {string} status - Booking status: 'Pending', 'Assigned', etc.
 * @returns {object} Google Maps marker icon configuration
 */
export const getBookingIcon = (status = 'Pending') => {
    // Color mapping based on booking status
    const colorMap = {
        Pending: '#FFFFFF',      // White - new booking, not yet in 15-min cycle
        Unassigned: '#EF4444',   // Red    - cycle ran, no driver found yet
        Delayed: '#A855F7',      // Purple - assigned but pickup time has passed
        Overdue: '#A855F7',      // Purple - pending but pickup time has passed
        Assigned: '#3B82F6',     // Blue   - successfully assigned
        Completed: '#10B981',    // Green  - booking completed
        default: '#3B82F6'
    };

    const fillColor = colorMap[status] || colorMap.default;

    // Classic map pin shape
    return {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: fillColor,      // Dynamic color based on status
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#1a1a1a',
        scale: 1.2,
        anchor: { x: 12, y: 22 },  // Anchor at pin bottom
        labelOrigin: { x: 12, y: 9 }
    };
};

/**
 * Generate a drop-point pin icon (shown when a booking is selected)
 * Same pin shape as booking icon, distinct color so drop is clearly different from pickup.
 * @returns {object} Google Maps marker icon configuration
 */
export const getDropIcon = () => {
    return {
        // Pushpin SVG Path
        path: 'M16 9V4.5C16 3.12 14.88 2 13.5 2h-3C9.12 2 8 3.12 8 4.5V9c-2.21 0-4 1.79-4 4s1.79 4 4 4h3v4h2v-4h3c2.21 0 4-1.79 4-4s-1.79-4-4-4z',
        fillColor: '#EF4444', // Red pushpin
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: '#1a1a1a',
        scale: 1.2,
        anchor: { x: 12, y: 21 }, // Anchor at pin bottom
        labelOrigin: { x: 12, y: 9 }
    };
};

/**
 * Hover effect configuration for markers
 * Can be applied on mouse over/out events
 */
export const markerHoverStyle = {
    scale: 1.6,  // Slightly larger on hover
    zIndex: 1000 // Bring to front
};

/**
 * Default marker style (non-hover)
 */
export const markerDefaultStyle = {
    scale: 1.4,  // Driver default
    zIndex: 1
};

export const bookingMarkerDefaultStyle = {
    scale: 1.2,  // Booking default
    zIndex: 1
};
