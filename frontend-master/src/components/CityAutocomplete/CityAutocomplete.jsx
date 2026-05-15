import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input, Badge } from 'reactstrap';
import config from '../../config';
import './CityAutocomplete.module.scss';

/**
 * CityAutocomplete Component
 * 
 * A multi-select autocomplete component for selecting cities.
 * Features:
 * - Debounced search with autocomplete suggestions
 * - Multi-city selection with visual chips
 * - "All Cities" option
 * - Integrates with backend /api/cities/search endpoint
 */
const CityAutocomplete = ({ selectedCities = [], onCitiesChange, apiBase }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState(null);
  const debounceTimer = useRef(null);
  const wrapperRef = useRef(null);

  // Determine which API base to use (default to customer API)
  const resolvedApiBase = apiBase || config.customerApiBase;

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch city suggestions from backend
  const fetchCitySuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${resolvedApiBase}/cities/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch city suggestions');
      }

      const data = await response.json();
      setSuggestions(data.cities || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error fetching city suggestions:', err);
      setError('Failed to load cities');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedApiBase]);

  // Debounced input handler
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new debounce timer (300ms delay)
    debounceTimer.current = setTimeout(() => {
      fetchCitySuggestions(value);
    }, 300);
  };

  // Add a city to selection
  const addCity = (city) => {
    if (!selectedCities.includes(city)) {
      onCitiesChange([...selectedCities, city]);
    }
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Remove a city from selection
  const removeCity = (cityToRemove) => {
    onCitiesChange(selectedCities.filter(city => city !== cityToRemove));
  };

  // Set "All Cities" mode
  const setAllCities = () => {
    onCitiesChange([]);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      addCity(suggestions[0]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const isAllCities = selectedCities.length === 0;

  return (
    <div className="city-autocomplete-wrapper" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Selected Cities Display */}
      <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '28px' }}>
        {isAllCities ? (
          <Badge color="info" style={{ fontSize: '12px', padding: '6px 10px' }}>
            🌍 All Cities
          </Badge>
        ) : (
          selectedCities.map((city) => (
            <Badge 
              key={city} 
              color="primary" 
              style={{ 
                fontSize: '12px', 
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {city}
              <span 
                onClick={() => removeCity(city)} 
                style={{ 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  fontSize: '14px',
                  marginLeft: '4px'
                }}
                title="Remove city"
              >
                ×
              </span>
            </Badge>
          ))
        )}
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
          placeholder="Type city name (e.g., Udupi, Bangalore)..."
          style={{ 
            fontSize: '14px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}
        />
        
        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            fontSize: '12px',
            color: '#9ca3af'
          }}>
            Searching...
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ 
          color: '#ef4444', 
          fontSize: '12px', 
          marginTop: '4px',
          padding: '4px 8px'
        }}>
          {error}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          marginTop: '4px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000
        }}>
          {suggestions.map((city) => (
            <div
              key={city}
              onClick={() => addCity(city)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s',
                borderBottom: '1px solid #f3f4f6'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📍 {city}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginTop: '12px'
      }}>
        <button
          onClick={setAllCities}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: isAllCities ? '#3b82f6' : 'white',
            color: isAllCities ? 'white' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🌍 All Cities
        </button>
        {!isAllCities && selectedCities.length > 0 && (
          <button
            onClick={() => onCitiesChange([])}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '6px',
              border: '1px solid #ef4444',
              backgroundColor: 'white',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
};

export default CityAutocomplete;
