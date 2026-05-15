"""
AP Rides — Driver API Routes
Driver registration, status management, location updates.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from utils.database import get_db
from utils.auth import get_current_user, require_role
from utils.helpers import get_ist_now
from models.models import User, Driver

router = APIRouter(prefix="/drivers", tags=["Drivers"])


# ── Ops Dashboard Routes (no auth for dev) ───────────────

@router.get("/")
def list_drivers(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List all drivers for the Ops Dashboard.
    Returns driver details joined with user info.
    """
    query = db.query(Driver, User).outerjoin(User, Driver.user_id == User.id)

    if status and status != "all":
        query = query.filter(Driver.verification_status == status)

    rows = query.order_by(Driver.id.desc()).all()

    drivers_list = []
    for driver, user in rows:
        drivers_list.append({
            "driver_id": driver.id,
            "name": user.name if user else "Unknown",
            "phone": str(user.phone_number) if user else "N/A",
            "license_number": driver.license_number or "N/A",
            "vehicle_registration": driver.vehicle_registration or "N/A",
            "vehicle_make": driver.vehicle_make,
            "vehicle_model": driver.vehicle_model,
            "verification_status": driver.verification_status,
            "is_online": driver.is_online,
            "is_blocked": not (user.is_active if user else True),
            "rating": float(driver.rating) if driver.rating else 5.0,
            "total_rides": driver.total_rides or 0,
            "current_lat": float(driver.current_lat) if driver.current_lat else None,
            "current_lng": float(driver.current_lng) if driver.current_lng else None,
        })

    return {"drivers": drivers_list, "total": len(drivers_list)}


@router.get("/{driver_id}")
def get_driver(driver_id: int, db: Session = Depends(get_db)):
    """Get single driver details for the edit page."""
    result = (
        db.query(Driver, User)
        .outerjoin(User, Driver.user_id == User.id)
        .filter(Driver.id == driver_id)
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="Driver not found")

    driver, user = result
    return {
        "driver_id": driver.id,
        "name": user.name if user else "Unknown",
        "phone": str(user.phone_number) if user else "N/A",
        "license_number": driver.license_number,
        "vehicle_registration": driver.vehicle_registration,
        "vehicle_make": driver.vehicle_make,
        "vehicle_model": driver.vehicle_model,
        "verification_status": driver.verification_status,
        "is_online": driver.is_online,
        "rating": float(driver.rating) if driver.rating else 5.0,
        "total_rides": driver.total_rides or 0,
        "upi_id": driver.upi_id,
    }


@router.put("/{driver_id}/state")
def update_driver_state(
    driver_id: int,
    state: str,
    db: Session = Depends(get_db),
):
    """Update driver verification status (verified/pending/rejected)."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    driver.verification_status = state
    if state == "verified":
        driver.verified_at = get_ist_now()
    db.commit()

    return {"success": True, "message": f"Driver status updated to {state}"}


@router.delete("/{driver_id}")
def delete_driver_record(driver_id: int, db: Session = Depends(get_db)):
    """Delete a driver record."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    db.delete(driver)
    db.commit()
    return {"success": True, "message": "Driver deleted"}


# ── Request Models ───────────────────────────────────────

class DriverRegisterRequest(BaseModel):
    vehicle_registration: str           # "KA-20-AB-1234"
    vehicle_make: str                   # "Bajaj"
    vehicle_model: str                  # "RE Compact"
    license_number: str                 # "KA2020123456789"
    upi_id: Optional[str] = None       # "driver@upi"

class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float


# ── Routes ───────────────────────────────────────────────

@router.post("/register")
def register_driver(
    req: DriverRegisterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register current user as a driver.
    Creates driver profile linked to the user account.
    """
    user_id = current_user["user_id"]

    # Check if already registered as driver
    existing = db.query(Driver).filter(Driver.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already registered as driver")

    # Check vehicle registration isn't taken
    reg_exists = (
        db.query(Driver)
        .filter(Driver.vehicle_registration == req.vehicle_registration.upper())
        .first()
    )
    if reg_exists:
        raise HTTPException(
            status_code=400,
            detail="Vehicle registration already registered",
        )

    # Update user role to driver
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.role = "driver"

    # Create driver record
    driver = Driver(
        user_id=user_id,
        vehicle_registration=req.vehicle_registration.upper(),
        vehicle_make=req.vehicle_make,
        vehicle_model=req.vehicle_model,
        license_number=req.license_number,
        upi_id=req.upi_id,
        verification_status="pending",
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)

    return {
        "success": True,
        "message": "Driver registered! Pending verification by ops team.",
        "data": {
            "driver_id": driver.id,
            "vehicle_registration": driver.vehicle_registration,
            "verification_status": driver.verification_status,
        },
    }


@router.post("/status/online")
def go_online(
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Mark driver as online and available for rides."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Temporarily bypassed for dev mode testing
    # if driver.verification_status != "verified":
    #     raise HTTPException(
    #         status_code=403,
    #         detail="Your account is not verified yet. Please wait for ops approval.",
    #     )

    driver.is_online = True
    driver.updated_at = get_ist_now()
    db.commit()

    return {
        "success": True,
        "message": "You are now ONLINE",
        "is_online": True,
    }


@router.post("/status/offline")
def go_offline(
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Mark driver as offline."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver.is_online = False
    driver.current_stand_id = None
    driver.updated_at = get_ist_now()

    # Remove from any stand queue
    from models.models import StandQueue
    db.query(StandQueue).filter(StandQueue.driver_id == driver.id).delete()

    db.commit()

    return {
        "success": True,
        "message": "You are now OFFLINE",
        "is_online": False,
    }


@router.post("/location")
def update_location(
    req: LocationUpdateRequest,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """
    Update driver's current GPS location.
    Called every 10-15 seconds from driver app.
    """
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver.current_lat = req.lat
    driver.current_lng = req.lng
    driver.last_location_update = get_ist_now()
    db.commit()

    return {"success": True}


@router.get("/earnings")
def get_earnings(
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Get today's earnings summary for the driver."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    from models.models import Ride

    # Get today's date range (IST)
    now = get_ist_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Query today's completed rides
    today_rides = (
        db.query(Ride)
        .filter(
            Ride.driver_id == driver.id,
            Ride.status == "ride_completed",
            Ride.ride_completed_at >= today_start,
            Ride.ride_completed_at <= today_end,
        )
        .all()
    )

    total_earning = sum(float(r.driver_earning or 0) for r in today_rides)
    total_active_km = sum(float(r.active_km or 0) for r in today_rides)
    total_dead_km = sum(
        float(r.initial_dead_km or 0) + float(r.return_dead_km or 0)
        for r in today_rides
    )
    dead_compensation = sum(float(r.return_dead_compensation or 0) for r in today_rides)

    return {
        "success": True,
        "data": {
            "today": {
                "rides": len(today_rides),
                "total_earning": round(total_earning, 2),
                "active_km": round(total_active_km, 2),
                "dead_km": round(total_dead_km, 2),
                "dead_km_compensation": round(dead_compensation, 2),
            },
            "overall": {
                "total_rides": driver.total_rides,
                "rating": float(driver.rating) if driver.rating else 5.0,
                "acceptance_rate": float(driver.acceptance_rate) if driver.acceptance_rate else 100.0,
            },
        },
    }
