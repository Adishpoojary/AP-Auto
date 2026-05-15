/**
 * Vehicle Data Loader
 * Parses master.csv and provides vehicle options based on class
 */

let vehicleDataCache = null;

/**
 * Parse CSV text into array of objects
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : '';
    });
    data.push(obj);
  }
  
  return data;
}

/**
 * Split vehicle name into make and model
 * Examples:
 *   "Tata Motors Ace Gold" -> { make: "Tata Motors", model: "Ace Gold" }
 *   "Bajaj RE Compact" -> { make: "Bajaj", model: "RE Compact" }
 */
function splitVehicleName(vehicleName) {
  const parts = vehicleName.trim().split(' ');
  
  if (parts.length === 1) {
    return { make: parts[0], model: parts[0] };
  }
  
  // For 2 parts: first is make, second is model
  if (parts.length === 2) {
    return { make: parts[0], model: parts[1] };
  }
  
  // For 3+ parts: 
  // Check if second word looks like it should be part of make (e.g., "Tata Motors")
  const secondWordIndicators = ['motors', 'motor', 'leyland', 'electric', 'seiki'];
  const secondWord = parts[1].toLowerCase();
  
  if (secondWordIndicators.some(indicator => secondWord.includes(indicator))) {
    // First two words are make, rest is model
    return {
      make: `${parts[0]} ${parts[1]}`,
      model: parts.slice(2).join(' ')
    };
  }
  
  // Default: first word is make, rest is model
  return {
    make: parts[0],
    model: parts.slice(1).join(' ')
  };
}

/**
 * Load and cache vehicle data from CSV
 */
export async function loadVehicleData() {
  if (vehicleDataCache) {
    return vehicleDataCache;
  }
  
  try {
    const response = await fetch('/master.csv');
    const csvText = await response.text();
    const rawData = parseCSV(csvText);
    
    // Transform data into usable format
    vehicleDataCache = rawData.map(row => {
      const { make, model } = splitVehicleName(row.vehicle_name);
      
      return {
        vehicle_name: row.vehicle_name,
        make: make,
        model: model,
        class: parseInt(row.Class) || 0,
        payload: row.payload,
        length: row.length,
        tonnage: row.Tonnage,
        popular_name: row['Popular Booking Word Name'] || '',
        popular_vehicle: row['Popular Vehicle'] || ''
      };
    });
    
    return vehicleDataCache;
  } catch (error) {
    console.error('Error loading vehicle data:', error);
    return [];
  }
}

/**
 * Get vehicles filtered by class
 */
export async function getVehiclesByClass(classNumber) {
  const data = await loadVehicleData();
  return data.filter(vehicle => vehicle.class === parseInt(classNumber));
}

/**
 * Get unique vehicle names by class (for dropdown)
 */
export async function getVehicleNamesByClass(classNumber) {
  const vehicles = await getVehiclesByClass(classNumber);
  
  // Remove duplicates and sort
  const uniqueVehicles = [];
  const seen = new Set();
  
  vehicles.forEach(vehicle => {
    const key = `${vehicle.make}|${vehicle.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueVehicles.push({
        vehicle_name: vehicle.vehicle_name,
        make: vehicle.make,
        model: vehicle.model,
        display: vehicle.vehicle_name // What user sees in dropdown
      });
    }
  });
  
  return uniqueVehicles.sort((a, b) => a.vehicle_name.localeCompare(b.vehicle_name));
}

/**
 * Get class display name
 */
export function getClassDisplayName(classNumber) {
  const classNames = {
    1: 'Class 1 - Goods Auto',
    2: 'Class 2 - Tata Ace',
    3: 'Class 3 - Pick Up 1 ton',
    4: 'Class 4 - Tempo (7 ft)',
    5: 'Class 5 - Pick Up (8ft)',
    6: 'Class 6 - Pick Up (10ft)',
    7: 'Class 7 - Pick up 3.5 ton',
    8: 'Class 8 - Pick up 12 ft',
    9: 'Class 9 - Pick up 14 ft',
    10: 'Class 10 - Pick up 18 ft',
    11: 'Class 11 - 12 ton',
    12: 'Class 12 - 16 ton'
  };
  
  return classNames[classNumber] || `Class ${classNumber}`;
}

/**
 * Get all available classes
 */
export function getAllClasses() {
  return [
    { value: 1, label: getClassDisplayName(1) },
    { value: 2, label: getClassDisplayName(2) },
    { value: 3, label: getClassDisplayName(3) },
    { value: 4, label: getClassDisplayName(4) },
    { value: 5, label: getClassDisplayName(5) },
    { value: 6, label: getClassDisplayName(6) },
    { value: 7, label: getClassDisplayName(7) },
    { value: 8, label: getClassDisplayName(8) },
    { value: 9, label: getClassDisplayName(9) },
    { value: 10, label: getClassDisplayName(10) },
    { value: 11, label: getClassDisplayName(11) },
    { value: 12, label: getClassDisplayName(12) }
  ];
}

/**
 * Find vehicle class based on make and model
 * Returns class number if found, null otherwise
 */
export async function getClassByMakeAndModel(make, model) {
  if (!make || !model) return null;
  
  const data = await loadVehicleData();
  
  // Normalize inputs for comparison
  const makeLower = make.toLowerCase().trim();
  const modelLower = model.toLowerCase().trim();
  
  // Find matching vehicle
  const match = data.find(vehicle => 
    vehicle.make.toLowerCase().trim() === makeLower &&
    vehicle.model.toLowerCase().trim() === modelLower
  );
  
  return match ? match.class : null;
}

/**
 * Search for vehicle by name and return vehicle details with class
 * Supports partial matching and fuzzy search
 */
export async function getVehicleDetailsByName(vehicleName) {
  if (!vehicleName || !vehicleName.trim()) return null;
  
  const data = await loadVehicleData();
  const searchTerm = vehicleName.toLowerCase().trim();
  
  // Try exact match first
  let match = data.find(vehicle => 
    vehicle.vehicle_name.toLowerCase().trim() === searchTerm
  );
  
  // If no exact match, try partial match
  if (!match) {
    match = data.find(vehicle => 
      vehicle.vehicle_name.toLowerCase().includes(searchTerm) ||
      searchTerm.includes(vehicle.vehicle_name.toLowerCase())
    );
  }
  
  // If still no match, try make + model combination
  if (!match) {
    match = data.find(vehicle => {
      const makeModel = `${vehicle.make} ${vehicle.model}`.toLowerCase();
      return makeModel.includes(searchTerm) || searchTerm.includes(makeModel);
    });
  }
  
  if (match) {
    return {
      vehicle_name: match.vehicle_name,
      make: match.make,
      model: match.model,
      class: match.class,
      payload: match.payload,
      length: match.length,
      tonnage: match.tonnage
    };
  }
  
  return null;
}
