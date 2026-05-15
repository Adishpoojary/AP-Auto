import React, { createContext, useState, useContext, useEffect } from 'react';

const CityContext = createContext();

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
};

export const CityProvider = ({ children }) => {
  // Multi-city selection (array of city names)
  const [selectedCities, setSelectedCities] = useState(() => {
    const stored = localStorage.getItem('selectedCities');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    // Migration: check if old single city exists
    const oldCity = localStorage.getItem('selectedCity');
    if (oldCity && oldCity !== '' && oldCity !== 'All') {
      return [oldCity];
    }
    return [];
  });

  // Backward compatibility: single city as first selected or ''
  const selectedCity = selectedCities.length > 0 ? selectedCities[0] : '';

  // Update cities (array)
  const setCities = (cities) => {
    const cityArray = Array.isArray(cities) ? cities : [];
    setSelectedCities(cityArray);
    localStorage.setItem('selectedCities', JSON.stringify(cityArray));
  };

  // Add a single city to the selection
  const addCity = (city) => {
    if (city && !selectedCities.includes(city)) {
      const newCities = [...selectedCities, city];
      setSelectedCities(newCities);
      localStorage.setItem('selectedCities', JSON.stringify(newCities));
    }
  };

  // Remove a single city from selection
  const removeCity = (cityToRemove) => {
    const newCities = selectedCities.filter(city => city !== cityToRemove);
    setSelectedCities(newCities);
    localStorage.setItem('selectedCities', JSON.stringify(newCities));
  };

  // Check if a city is selected
  const hasCity = (city) => {
    return selectedCities.includes(city);
  };

  // Clear all cities (sets to "All Cities" mode)
  const clearCities = () => {
    setSelectedCities([]);
    localStorage.setItem('selectedCities', JSON.stringify([]));
    localStorage.removeItem('selectedCity'); // Clear old format
  };

  // Backward compatibility: update single city (converts to array)
  const updateCity = (city) => {
    if (!city || city === '' || city === 'All') {
      clearCities();
    } else {
      setCities([city]);
    }
    // Also update old format for legacy code
    localStorage.setItem('selectedCity', city || '');
  };

  // Backward compatibility: clear single city
  const clearCity = () => {
    clearCities();
  };

  return (
    <CityContext.Provider value={{ 
      // New multi-city API
      selectedCities, 
      setCities,
      addCity,
      removeCity,
      hasCity,
      clearCities,
      // Backward compatible single-city API
      selectedCity, 
      updateCity, 
      clearCity 
    }}>
      {children}
    </CityContext.Provider>
  );
};

export default CityContext;
