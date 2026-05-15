"""
AP Rides — Auto Stands API Routes
Find nearby stands, view stand details, driver check-in/out.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel
from typing import Optional, List

from utils.database import get_db
from utils.auth import get_current_user, require_role
from utils.helpers import haversine_distance
from models.models import Stand, StandQueue, Driver

router = APIRouter(prefix="/stands", tags=["Stands"])


# ── Response Models ──────────────────────────────────────

class StandResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    latitude: float
    longitude: float
    city: str
    zone: str
    total_capacity: int
    available_drivers: int
    distance_km: Optional[float] = None


# ── Routes ───────────────────────────────────────────────

@router.get("/nearby")
def get_nearby_stands(
    lat: float = Query(..., description="Your latitude"),
    lng: float = Query(..., description="Your longitude"),
    radius_km: float = Query(5.0, description="Search radius in km"),
    db: Session = Depends(get_db),
):
    """
    Find auto stands near a given location.
    Returns stands sorted by distance with available driver count.
    """
    # Get all active stands
    stands = db.query(Stand).filter(Stand.is_active == True).all()

    nearby = []
    for stand in stands:
        dist = haversine_distance(
            lat, lng, float(stand.latitude), float(stand.longitude)
        )
        if dist <= radius_km:
            # Count available drivers at this stand
            available_count = (
                db.query(StandQueue)
                .filter(
                    StandQueue.stand_id == stand.id,
                    StandQueue.is_available == True,
                )
                .count()
            )

            nearby.append({
                "id": stand.id,
                "name": stand.name,
                "address": stand.address,
                "latitude": float(stand.latitude),
                "longitude": float(stand.longitude),
                "city": stand.city,
                "zone": stand.zone,
                "total_capacity": stand.total_capacity,
                "available_drivers": available_count,
                "distance_km": dist,
            })

    # Sort by distance (nearest first)
    nearby.sort(key=lambda x: x["distance_km"])

    return {
        "success": True,
        "data": nearby,
        "count": len(nearby),
        "search": {"lat": lat, "lng": lng, "radius_km": radius_km},
    }


@router.get("/")
def list_all_stands(
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all active stands, optionally filtered by city."""
    query = db.query(Stand).filter(Stand.is_active == True)
    if city:
        query = query.filter(Stand.city.ilike(f"%{city}%"))

    stands = query.order_by(Stand.city, Stand.name).all()

    result = []
    for stand in stands:
        available_count = (
            db.query(StandQueue)
            .filter(StandQueue.stand_id == stand.id, StandQueue.is_available == True)
            .count()
        )
        result.append({
            "id": stand.id,
            "name": stand.name,
            "address": stand.address,
            "latitude": float(stand.latitude),
            "longitude": float(stand.longitude),
            "city": stand.city,
            "zone": stand.zone,
            "total_capacity": stand.total_capacity,
            "available_drivers": available_count,
        })

    return {"success": True, "data": result, "count": len(result)}


@router.get("/{stand_id}")
def get_stand_details(stand_id: int, db: Session = Depends(get_db)):
    """Get detailed info about a specific stand including driver queue."""
    stand = db.query(Stand).filter(Stand.id == stand_id).first()
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")

    # Get driver queue
    queue_entries = (
        db.query(StandQueue, Driver)
        .join(Driver, StandQueue.driver_id == Driver.id)
        .filter(StandQueue.stand_id == stand_id)
        .order_by(StandQueue.queue_position)
        .all()
    )

    drivers = []
    for sq, driver in queue_entries:
        drivers.append({
            "driver_id": driver.id,
            "queue_position": sq.queue_position,
            "is_available": sq.is_available,
            "checked_in_at": str(sq.checked_in_at) if sq.checked_in_at else None,
            "rating": float(driver.rating) if driver.rating else 5.0,
            "total_rides": driver.total_rides,
            "acceptance_rate": float(driver.acceptance_rate) if driver.acceptance_rate else 100.0,
            "vehicle_registration": driver.vehicle_registration,
        })

    return {
        "success": True,
        "data": {
            "id": stand.id,
            "name": stand.name,
            "address": stand.address,
            "latitude": float(stand.latitude),
            "longitude": float(stand.longitude),
            "city": stand.city,
            "zone": stand.zone,
            "total_capacity": stand.total_capacity,
            "opens_at": str(stand.opens_at) if stand.opens_at else None,
            "closes_at": str(stand.closes_at) if stand.closes_at else None,
            "drivers": drivers,
            "driver_count": len(drivers),
            "available_count": sum(1 for d in drivers if d["is_available"]),
        },
    }


@router.post("/{stand_id}/checkin")
def driver_checkin(
    stand_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """
    Driver checks into an auto stand.
    Adds them to the end of the FIFO queue.
    """
    # Get driver record
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    if driver.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Driver not verified yet")

    # Check stand exists
    stand = db.query(Stand).filter(Stand.id == stand_id, Stand.is_active == True).first()
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")

    # Check if already checked in somewhere
    existing = db.query(StandQueue).filter(StandQueue.driver_id == driver.id).first()
    if existing:
        if existing.stand_id == stand_id:
            return {"success": True, "message": "Already checked into this stand"}
        # Remove from previous stand
        db.delete(existing)
        db.flush()

    # Get next queue position
    max_pos = (
        db.query(func.max(StandQueue.queue_position))
        .filter(StandQueue.stand_id == stand_id)
        .scalar()
    )
    next_pos = (max_pos or 0) + 1

    # Add to queue
    queue_entry = StandQueue(
        stand_id=stand_id,
        driver_id=driver.id,
        queue_position=next_pos,
        is_available=True,
    )
    db.add(queue_entry)

    # Update driver record
    driver.current_stand_id = stand_id
    driver.is_online = True

    db.commit()

    return {
        "success": True,
        "message": f"Checked into {stand.name}",
        "queue_position": next_pos,
        "stand": {"id": stand.id, "name": stand.name},
    }


@router.post("/{stand_id}/checkout")
def driver_checkout(
    stand_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver checks out of an auto stand."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Remove from queue
    queue_entry = (
        db.query(StandQueue)
        .filter(StandQueue.stand_id == stand_id, StandQueue.driver_id == driver.id)
        .first()
    )
    if not queue_entry:
        raise HTTPException(status_code=404, detail="Not checked into this stand")

    removed_position = queue_entry.queue_position
    db.delete(queue_entry)

    # Re-number queue positions (fill the gap)
    remaining = (
        db.query(StandQueue)
        .filter(
            StandQueue.stand_id == stand_id,
            StandQueue.queue_position > removed_position,
        )
        .order_by(StandQueue.queue_position)
        .all()
    )
    for entry in remaining:
        entry.queue_position -= 1

    # Update driver
    driver.current_stand_id = None

    db.commit()

    return {"success": True, "message": "Checked out of stand"}
