import React, { useState } from 'react';
import { useCity } from '../../contexts/CityContext';
import './CitySelector.css';

const CitySelector = () => {
  const { selectedCity, updateCity, clearCity } = useCity();
  const [inputValue, setInputValue] = useState(selectedCity);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cityName = inputValue.trim();
    if (cityName) {
      updateCity(cityName);
    }
  };

  const handleSetAll = () => {
    setInputValue('All');
    updateCity('All');
  };

  const handleClear = () => {
    setInputValue('');
    clearCity();
  };

  return (
    <div className="city-selector-container">
      <div className="city-selector-card">
        <h3>🏙️ Select Your City</h3>
        <p className="city-selector-desc">
          Filter all dashboard data by city. Only vehicles, bookings, and assignments from the selected city will be displayed. Select "All" to view all cities.
        </p>
        
        <form onSubmit={handleSubmit} className="city-selector-form">
          <div className="input-group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter city name (e.g., Udupi, Bangalore, All)"
              className="city-input"
            />
            <button type="submit" className="btn-set-city">
              Set City
            </button>
            <button type="button" onClick={handleSetAll} className="btn-all-cities">
              All Cities
            </button>
            {selectedCity && selectedCity !== 'All' && (
              <button type="button" onClick={handleClear} className="btn-clear-city">
                Clear
              </button>
            )}
          </div>
        </form>

        {selectedCity && (
          <div className="current-city-display">
            <span className="current-city-label">Currently viewing:</span>
            <span className="current-city-name">
              {selectedCity === 'All' ? '🌍 All Cities' : selectedCity}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitySelector;
