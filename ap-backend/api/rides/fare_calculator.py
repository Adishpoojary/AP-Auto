"""
AP Rides — Fare Calculator
The 3-part fare model: Initial Dead KM + Active Ride + Return Dead KM

This is AP's core innovation — drivers get paid for return dead mileage.
"""
from typing import Optional
from sqlalchemy.orm import Session
from models.models import ZonePricing, Stand
from utils.helpers import haversine_distance


def calculate_fare(
    pickup_lat: float,
    pickup_lng: float,
    drop_lat: float,
    drop_lng: float,
    stand_lat: float,
    stand_lng: float,
    zone: str,
    db: Session,
    active_km_override: Optional[float] = None,
) -> dict:
    """
    Calculate the complete fare breakdown for a ride.
    
    Args:
        pickup_lat/lng: Customer pickup GPS
        drop_lat/lng: Customer drop GPS
        stand_lat/lng: Driver's auto stand GPS
        zone: 'urban', 'semi_urban', or 'rural'
        db: Database session
        active_km_override: If provided, use this instead of haversine (for Google API distance)
    
    Returns:
        Dict with complete fare breakdown
    """
    # Get zone pricing from database
    pricing = (
        db.query(ZonePricing)
        .filter(ZonePricing.zone == zone, ZonePricing.is_active == True)
        .first()
    )
    
    if not pricing:
        # Fallback defaults
        pricing_data = {
            "base_fare": 30, "per_km_rate": 15, "per_minute_wait": 2,
            "initial_dead_flat": 25, "initial_dead_per_km": 8, "initial_dead_free_km": 2,
            "return_dead_per_km": 5, "return_dead_cap": 50, "return_surcharge": 20,
            "driver_share_pct": 80, "ap_commission_pct": 20, "min_fare": 50,
        }
    else:
        pricing_data = {
            "base_fare": float(pricing.base_fare),
            "per_km_rate": float(pricing.per_km_rate),
            "per_minute_wait": float(pricing.per_minute_wait),
            "initial_dead_flat": float(pricing.initial_dead_flat),
            "initial_dead_per_km": float(pricing.initial_dead_per_km),
            "initial_dead_free_km": float(pricing.initial_dead_free_km),
            "return_dead_per_km": float(pricing.return_dead_per_km),
            "return_dead_cap": float(pricing.return_dead_cap),
            "return_surcharge": float(pricing.return_surcharge),
            "driver_share_pct": float(pricing.driver_share_pct),
            "ap_commission_pct": float(pricing.ap_commission_pct),
            "min_fare": float(pricing.min_fare),
        }
    
    p = pricing_data

    # ── Calculate distances ──────────────────────────────
    
    # Initial dead km: Stand → Pickup (haversine × 1.3 road factor)
    initial_dead_km = round(haversine_distance(stand_lat, stand_lng, pickup_lat, pickup_lng) * 1.3, 2)
    
    # Active km: Pickup → Drop
    if active_km_override is not None:
        active_km = active_km_override
    else:
        active_km = round(haversine_distance(pickup_lat, pickup_lng, drop_lat, drop_lng) * 1.3, 2)
    
    # Return dead km: Drop → Stand
    return_dead_km = round(haversine_distance(drop_lat, drop_lng, stand_lat, stand_lng) * 1.3, 2)
    
    total_km = round(initial_dead_km + active_km + return_dead_km, 2)

    # ── Part A: Initial Dead KM Charge ───────────────────
    if initial_dead_km <= p["initial_dead_free_km"]:
        initial_dead_charge = p["initial_dead_flat"]
    else:
        extra_km = initial_dead_km - p["initial_dead_free_km"]
        initial_dead_charge = p["initial_dead_flat"] + (extra_km * p["initial_dead_per_km"])
    initial_dead_charge = round(initial_dead_charge, 2)

    # ── Part B: Active Ride Fare ─────────────────────────
    active_fare = round(active_km * p["per_km_rate"], 2)

    # ── Part C: Return Dead KM ───────────────────────────
    # Return compensation for driver (capped)
    return_dead_compensation = round(
        min(return_dead_km * p["return_dead_per_km"], p["return_dead_cap"]), 2
    )
    # Return surcharge for customer (flat amount)
    return_surcharge = p["return_surcharge"]

    # ── Total Customer Fare ──────────────────────────────
    total_customer_fare = round(
        p["base_fare"] + active_fare + initial_dead_charge + return_surcharge, 2
    )
    # Apply minimum fare
    total_customer_fare = max(total_customer_fare, p["min_fare"])

    # ── Driver Earning ───────────────────────────────────
    driver_active_share = round(active_fare * (p["driver_share_pct"] / 100), 2)
    driver_earning = round(
        initial_dead_charge + driver_active_share + return_dead_compensation, 2
    )

    # ── AP Commission ────────────────────────────────────
    ap_commission = round(
        (active_fare * (p["ap_commission_pct"] / 100)) + return_surcharge - return_dead_compensation, 2
    )

    # ── Estimated duration (rough: 25 km/h average in town) ──
    estimated_duration_min = round((active_km / 25) * 60)

    return {
        # Distances
        "initial_dead_km": initial_dead_km,
        "active_km": active_km,
        "return_dead_km": return_dead_km,
        "total_km": total_km,
        "estimated_duration_min": max(estimated_duration_min, 5),
        
        # Customer pays
        "base_fare": p["base_fare"],
        "per_km_rate": p["per_km_rate"],
        "active_fare": active_fare,
        "initial_dead_charge": initial_dead_charge,
        "return_surcharge": return_surcharge,
        "total_customer_fare": total_customer_fare,
        
        # Driver gets
        "return_dead_compensation": return_dead_compensation,
        "driver_earning": driver_earning,
        
        # AP keeps
        "ap_commission": ap_commission,
        
        # Zone
        "zone": zone,
    }
