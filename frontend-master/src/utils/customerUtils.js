import React from 'react';

/**
 * Returns a standardized display for a customer and their ID.
 * Format:
 * Customer Name
 * ID #<customer_id>
 * 
 * @param {Object} customer - An object containing customer properties.
 * @returns {React.ReactNode} The formatted display.
 */
export const getCustomerDisplay = (customer) => {
    if (!customer) return '—';
    
    // In some payloads it's customer_name, in others it's just name or customer
    const name = customer.customer_name || customer.name || customer.customer || 'Unknown Customer';
    const cId = customer.customer_id;
    
    if (cId !== undefined && cId !== null && cId !== '') {
        return (
            <div>
                <div className="font-weight-bold">{name}</div>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>ID #{cId}</div>
            </div>
        );
    }
    
    return <div className="font-weight-bold">{name}</div>;
};
