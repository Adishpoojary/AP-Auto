import React, { useState, useRef, useEffect } from 'react';

const panelStyles = {
    container: {
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 99,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    toggleBtn: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--bs-body-bg, #fff)',
        color: 'var(--bs-body-color, #333)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        transition: 'background 0.15s',
    },
    panel: {
        position: 'absolute',
        top: '48px',
        left: 0,
        background: 'var(--bs-body-bg, #fff)',
        color: 'var(--bs-body-color, #212529)',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        padding: '14px 16px',
        minWidth: '210px',
        maxHeight: 'min(360px, 55vh)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        msOverflowStyle: 'none',
        zIndex: 10002,
    },
    title: {
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--bs-secondary-color, #555)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 0',
    },
    label: {
        fontSize: '13px',
        color: 'var(--bs-body-color, #333)',
        cursor: 'pointer',
        userSelect: 'none',
    },
    subSection: {
        paddingLeft: '18px',
        borderLeft: '2px solid var(--bs-border-color, #eee)',
        marginLeft: '4px',
        marginTop: '2px',
        marginBottom: '2px',
    },
    subLabel: {
        fontSize: '12px',
        color: 'var(--bs-secondary-color, #666)',
        cursor: 'pointer',
        userSelect: 'none',
    },
    divider: {
        height: '1px',
        background: 'var(--bs-border-color, #f0f0f0)',
        margin: '6px 0',
    },
};

// Mini toggle switch rendered inline
const ToggleSwitch = ({ checked, onChange = () => {}, id, disabled = false }) => {
    const trackStyle = {
        position: 'relative',
        width: '34px',
        height: '18px',
        borderRadius: '9px',
        background: disabled ? '#f0f0f0' : checked ? '#4285F4' : '#ccc',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
    };
    const thumbStyle = {
        position: 'absolute',
        top: '2px',
        left: checked ? '18px' : '2px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
    };

    return (
        <div
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled}
            id={id}
            style={trackStyle}
            onClick={() => !disabled && onChange(!checked)}
        >
            <div style={thumbStyle} />
        </div>
    );
};

const MapLayerPanel = ({
    showServiceZone, setShowServiceZone,
    showHotzones, setShowHotzones,
    showRealtimeHotzones, setShowRealtimeHotzones,
    showHistoricalHotzones, setShowHistoricalHotzones,
    showDrivers, setShowDrivers,
    showRegisteredVehicles, setShowRegisteredVehicles,
    showBookings, setShowBookings,
    showCriticalOnly, setShowCriticalOnly,
    showCompletedBookings, setShowCompletedBookings,
}) => {
    const [expanded, setExpanded] = useState(false);
    const anchorRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!expanded) return;
        const handleMouseDown = (e) => {
            if (
                anchorRef.current?.contains(e.target) ||
                panelRef.current?.contains(e.target)
            ) return;
            setExpanded(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [expanded]);

    return (
        <div style={panelStyles.container} ref={anchorRef}>
            <button
                type="button"
                style={{
                    ...panelStyles.toggleBtn,
                    background: expanded ? '#4285F4' : 'var(--bs-body-bg, #fff)',
                    color: expanded ? '#fff' : 'var(--bs-body-color, #333)',
                }}
                onClick={() => setExpanded((prev) => !prev)}
                title="Map Layers"
            >
                <span role="img" aria-label="layers">🗺️</span>
            </button>
            {expanded && (
                <div
                    ref={panelRef}
                    style={panelStyles.panel}
                    role="dialog"
                    aria-label="Map Layers"
                >
                    <div style={panelStyles.title}>Map Layers</div>

                    {/* Serviceable Zone */}
                    <div style={panelStyles.row}>
                        <label
                            style={panelStyles.label}
                            htmlFor="lp-serviceZone"
                            onClick={() => setShowServiceZone(v => !v)}
                        >
                            🟢 Serviceable Zone
                        </label>
                        <ToggleSwitch
                            checked={showServiceZone}
                            onChange={setShowServiceZone}
                            id="lp-serviceZone"
                        />
                    </div>

                    <div style={panelStyles.divider} />

                    {/* Hotzone Areas */}
                    <div style={panelStyles.row}>
                        <label
                            style={panelStyles.label}
                            htmlFor="lp-hotzones"
                            onClick={() => setShowHotzones(v => !v)}
                        >
                            🔥 Hotzone Areas
                        </label>
                        <ToggleSwitch
                            checked={showHotzones}
                            onChange={setShowHotzones}
                            id="lp-hotzones"
                        />
                    </div>

                    {/* Hotzone sub-toggles */}
                    {showHotzones && (
                        <div style={panelStyles.subSection}>
                            <div style={panelStyles.row}>
                                <label
                                    style={panelStyles.subLabel}
                                    htmlFor="lp-realtimeHz"
                                    onClick={() => setShowRealtimeHotzones(v => !v)}
                                >
                                    🔴 Today's Demand
                                </label>
                                <ToggleSwitch
                                    checked={showRealtimeHotzones}
                                    onChange={setShowRealtimeHotzones}
                                    id="lp-realtimeHz"
                                />
                            </div>
                            <div style={panelStyles.row}>
                                <label
                                    style={panelStyles.subLabel}
                                    htmlFor="lp-historicalHz"
                                    onClick={() => setShowHistoricalHotzones(v => !v)}
                                >
                                    🟡 Vehicle Recommendation
                                </label>
                                <ToggleSwitch
                                    checked={showHistoricalHotzones}
                                    onChange={setShowHistoricalHotzones}
                                    id="lp-historicalHz"
                                />
                            </div>
                        </div>
                    )}

                    <div style={panelStyles.divider} />

                    {/* Vehicles */}
                    <div style={panelStyles.row}>
                        <label
                            style={panelStyles.label}
                            htmlFor="lp-drivers"
                            onClick={() => setShowDrivers(v => !v)}
                        >
                            🚛 Vehicles
                        </label>
                        <ToggleSwitch
                            checked={showDrivers}
                            onChange={setShowDrivers}
                            id="lp-drivers"
                        />
                    </div>

                    {/* Vehicles sub-toggle: Registered Vehicles */}
                    {showDrivers && (
                        <div style={panelStyles.subSection}>
                            <div style={panelStyles.row}>
                                <label
                                    style={{
                                        ...panelStyles.subLabel,
                                        color: showRegisteredVehicles ? '#9CA3AF' : '#666',
                                        fontWeight: showRegisteredVehicles ? 600 : 400,
                                    }}
                                    htmlFor="lp-registeredVehicles"
                                    onClick={() => setShowRegisteredVehicles(v => !v)}
                                >
                                    <span style={{ marginRight: '6px', color: '#9CA3AF', fontSize: '12px' }}>⬤</span> Registered Vehicles
                                </label>
                                <ToggleSwitch
                                    checked={showRegisteredVehicles}
                                    onChange={setShowRegisteredVehicles}
                                    id="lp-registeredVehicles"
                                />
                            </div>
                        </div>
                    )}

                    <div style={panelStyles.divider} />

                    {/* Bookings */}
                    <div style={panelStyles.row}>
                        <label
                            style={panelStyles.label}
                            htmlFor="lp-bookings"
                            onClick={() => setShowBookings(v => !v)}
                        >
                            📦 Bookings
                        </label>
                        <ToggleSwitch
                            checked={showBookings}
                            onChange={setShowBookings}
                            id="lp-bookings"
                        />
                    </div>

                    {/* Critical Only sub-toggle */}
                    <div style={panelStyles.subSection}>
                        <div style={panelStyles.row}>
                            <label
                                style={{
                                    ...panelStyles.subLabel,
                                    color: !showBookings ? '#aaa' : (showCriticalOnly ? '#ef4444' : '#666'),
                                    fontWeight: showCriticalOnly ? 600 : 400,
                                    cursor: !showBookings ? 'not-allowed' : 'pointer'
                                }}
                                htmlFor="lp-criticalOnly"
                                onClick={() => showBookings && setShowCriticalOnly(v => !v)}
                            >
                                ⚡ Critical Only
                            </label>
                            <ToggleSwitch
                                checked={showCriticalOnly}
                                onChange={setShowCriticalOnly}
                                id="lp-criticalOnly"
                                disabled={!showBookings}
                            />
                        </div>
                        <div style={panelStyles.row}>
                            <label
                                style={{
                                    ...panelStyles.subLabel,
                                    color: !showBookings ? '#aaa' : (showCompletedBookings ? '#10b981' : '#666'),
                                    fontWeight: showCompletedBookings ? 600 : 400,
                                    cursor: !showBookings ? 'not-allowed' : 'pointer'
                                }}
                                htmlFor="lp-completed"
                                onClick={() => showBookings && setShowCompletedBookings(v => !v)}
                            >
                                ✅ Completed
                            </label>
                            <ToggleSwitch
                                checked={showCompletedBookings}
                                onChange={setShowCompletedBookings}
                                id="lp-completed"
                                disabled={!showBookings}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapLayerPanel;
