"""
AP Rides — Google Maps Service
Handles all Google Maps API calls: directions, geocoding, distance.
Uses the free $200/month credit.
"""
import httpx
from typing import Optional
from config import Config


MAPS_BASE_URL = "https://maps.googleapis.com/maps/api"


async def get_directions(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> Optional[dict]:
    """
    Get driving directions between two points using Google Directions API.
    
    Returns:
        Dict with distance_km, duration_min, and polyline, or None on error.
    """
    if not Config.GOOGLE_MAPS_API_KEY:
        # Fallback: use haversine × 1.3 if no API key
        from utils.helpers import haversine_distance
        dist = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        road_dist = round(dist * 1.3, 2)
        return {
            "distance_km": road_dist,
            "duration_min": round((road_dist / 25) * 60),
            "polyline": None,
            "source": "haversine_estimate",
        }
    
    url = f"{MAPS_BASE_URL}/directions/json"
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode": "driving",
        "key": Config.GOOGLE_MAPS_API_KEY,
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
        
        if data["status"] != "OK" or not data["routes"]:
            return None
        
        route = data["routes"][0]
        leg = route["legs"][0]
        
        return {
            "distance_km": round(leg["distance"]["value"] / 1000, 2),
            "duration_min": round(leg["duration"]["value"] / 60),
            "polyline": route["overview_polyline"]["points"],
            "source": "google_directions",
        }
    except Exception as e:
        print(f"❌ Google Directions API error: {e}")
        return None


async def geocode_address(address: str) -> Optional[dict]:
    """
    Convert an address string to GPS coordinates.
    
    Returns:
        Dict with lat, lng, formatted_address, or None on error.
    """
    if not Config.GOOGLE_MAPS_API_KEY:
        return None
    
    url = f"{MAPS_BASE_URL}/geocode/json"
    params = {
        "address": address,
        "key": Config.GOOGLE_MAPS_API_KEY,
        "region": "in",   # Bias results to India
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
        
        if data["status"] != "OK" or not data["results"]:
            return None
        
        result = data["results"][0]
        location = result["geometry"]["location"]
        
        return {
            "lat": location["lat"],
            "lng": location["lng"],
            "formatted_address": result["formatted_address"],
        }
    except Exception as e:
        print(f"❌ Google Geocoding API error: {e}")
        return None


async def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """
    Convert GPS coordinates to a readable address.
    
    Returns:
        Formatted address string, or None on error.
    """
    if not Config.GOOGLE_MAPS_API_KEY:
        return f"Location ({lat}, {lng})"
    
    url = f"{MAPS_BASE_URL}/geocode/json"
    params = {
        "latlng": f"{lat},{lng}",
        "key": Config.GOOGLE_MAPS_API_KEY,
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
        
        if data["status"] != "OK" or not data["results"]:
            return None
        
        return data["results"][0]["formatted_address"]
    except Exception as e:
        print(f"❌ Google Reverse Geocoding error: {e}")
        return None


async def get_place_autocomplete(query: str, lat: float = 13.34, lng: float = 74.75) -> list:
    """
    Get place suggestions as user types (for "Where to?" search bar).
    Biased towards Udupi/Mangalore region.
    
    Returns:
        List of place suggestions with description and place_id.
    """
    if not Config.GOOGLE_MAPS_API_KEY:
        return []
    
    url = f"{MAPS_BASE_URL}/place/autocomplete/json"
    params = {
        "input": query,
        "key": Config.GOOGLE_MAPS_API_KEY,
        "location": f"{lat},{lng}",
        "radius": 50000,           # 50km radius bias
        "components": "country:in",
        "types": "geocode|establishment",
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
        
        if data["status"] != "OK":
            return []
        
        return [
            {
                "description": p["description"],
                "place_id": p["place_id"],
            }
            for p in data.get("predictions", [])[:5]
        ]
    except Exception as e:
        print(f"❌ Google Places API error: {e}")
        return []


async def get_place_details(place_id: str) -> Optional[dict]:
    """
    Get lat/lng from a Google Place ID.
    Used after user selects from autocomplete.
    """
    if not Config.GOOGLE_MAPS_API_KEY:
        return None
    
    url = f"{MAPS_BASE_URL}/place/details/json"
    params = {
        "place_id": place_id,
        "key": Config.GOOGLE_MAPS_API_KEY,
        "fields": "geometry,formatted_address,name",
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            data = response.json()
        
        if data["status"] != "OK":
            return None
        
        result = data["result"]
        location = result["geometry"]["location"]
        
        return {
            "lat": location["lat"],
            "lng": location["lng"],
            "name": result.get("name", ""),
            "formatted_address": result.get("formatted_address", ""),
        }
    except Exception as e:
        print(f"❌ Google Place Details error: {e}")
        return None
