import React, { useState, useRef, useEffect, useCallback } from 'react';
import config from '../config';

const API_KEY = config.googleMapsApiKey || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * PlacesAutocompleteInput
 *
 * A drop-in replacement for google.maps.places.Autocomplete that uses the
 * Places API (New) REST endpoints — no legacy widget, no LegacyApiNotActivatedMapError.
 *
 * Props:
 *   value          {string}   controlled input value
 *   onChange       {fn}       called on every keystroke: (text) => void
 *   onPlaceSelect  {fn}       called when user picks a suggestion:
 *                             ({ address, lat, lng }) => void
 *   placeholder    {string}
 *   inputStyle     {object}   extra inline styles for the <input>
 *   disabled       {boolean}
 */
const PlacesAutocompleteInput = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Type to search — select from dropdown...',
  inputStyle = {},
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch autocomplete suggestions from Places API (New)
  const fetchSuggestions = useCallback(async (input) => {
    if (!input || input.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
          },
          body: JSON.stringify({
            input: input.trim(),
            includedRegionCodes: ['in'],
          }),
        }
      );
      const data = await res.json();
      const items = (data.suggestions || [])
        .filter((s) => s.placePrediction)
        .map((s) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text?.text || '',
          structuredFormat: s.placePrediction.structuredFormat,
        }));
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch (err) {
      console.error('[PlacesAutocomplete] fetch error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce input changes
  const handleInput = (e) => {
    const text = e.target.value;
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  // Fetch place details (lat/lng + address) when user selects a prediction
  const handleSelect = async (suggestion) => {
    setOpen(false);
    setSuggestions([]);
    onChange(suggestion.text);

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
          },
        }
      );
      const place = await res.json();
      const address = place.formattedAddress || place.displayName?.text || suggestion.text;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;

      onChange(address);
      if (onPlaceSelect && lat != null && lng != null) {
        onPlaceSelect({ address, lat: lat.toFixed(8), lng: lng.toFixed(8) });
      }
    } catch (err) {
      console.error('[PlacesAutocomplete] details error:', err);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          ...inputStyle,
        }}
      />

      {/* Loading indicator inside input */}
      {loading && (
        <div style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 12,
          color: '#9ca3af',
          pointerEvents: 'none',
        }}>
          ⏳
        </div>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          zIndex: 9999,
          top: '100%',
          left: 0,
          right: 0,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          background: '#fff',
          border: '1px solid #d1d5db',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 260,
          overflowY: 'auto',
        }}>
          {suggestions.map((s) => {
            const main = s.structuredFormat?.mainText?.text || s.text;
            const secondary = s.structuredFormat?.secondaryText?.text || '';
            return (
              <li
                key={s.placeId}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontWeight: 600, color: '#111827' }}>📍 {main}</span>
                {secondary && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{secondary}</span>
                )}
              </li>
            );
          })}
          <li style={{
            padding: '6px 14px',
            fontSize: 11,
            color: '#9ca3af',
            textAlign: 'right',
            background: '#fafafa',
            borderTop: '1px solid #f3f4f6',
          }}>
            Powered by Google
          </li>
        </ul>
      )}
    </div>
  );
};

export default PlacesAutocompleteInput;
