"""
AP Rides — Ride API Routes
Book rides, track rides, complete rides.
"""
import json
import hashlib
import hmac
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from utils.database import get_db
from utils.auth import get_current_user, require_role
from utils.helpers import generate_booking_code, generate_otp, haversine_distance, get_ist_now
from models.models import Ride, RideOffer, Stand, StandQueue, Driver, User, ZonePricing, Transaction
from api.rides.fare_calculator import calculate_fare
from api.dispatch.ws import manager
from services.maps_service import reverse_geocode
from config import Config

router = APIRouter(prefix="/rides", tags=["Rides"])


# ── Request Models ───────────────────────────────────────

class FareEstimateRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float

class RideRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_address: str
    drop_lat: float
    drop_lng: float
    drop_address: str

class RateRideRequest(BaseModel):
    rating: int            # 1-5 stars
    feedback: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ── Routes ───────────────────────────────────────────────

@router.post("/estimate")
def get_fare_estimate(
    req: FareEstimateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get fare estimate BEFORE booking.
    Finds the nearest stand and calculates fare.
    No driver assignment happens here — just pricing.
    """
    stands = db.query(Stand).filter(Stand.is_active == True).all()
    
    best_stand = None
    best_distance = float("inf")
    
    for stand in stands:
        dist = haversine_distance(
            req.pickup_lat, req.pickup_lng,
            float(stand.latitude), float(stand.longitude),
        )
        if dist < best_distance:
            best_distance = dist
            best_stand = stand
    
    if not best_stand:
        return {
            "success": False,
            "message": "No auto stands found in your area.",
            "data": None,
        }
    
    # Calculate fare
    fare = calculate_fare(
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        stand_lat=float(best_stand.latitude),
        stand_lng=float(best_stand.longitude),
        zone=best_stand.zone,
        db=db,
    )
    
    return {
        "success": True,
        "data": {
            "fare": fare,
            "stand": {
                "id": best_stand.id,
                "name": best_stand.name,
                "distance_km": round(best_distance, 2),
            },
        },
    }


@router.post("/request")
async def request_ride(
    req: RideRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Book a ride. Creates a PENDING ride in the pool.
    The auto-assigner (runs every 5 min) will find and assign the best driver.
    
    Flow: Customer books → status='pending' → Assigner assigns → Driver accepts → Ride starts
    """
    customer_id = current_user["user_id"]
    
    # Find nearest stand for fare calculation
    stands = db.query(Stand).filter(Stand.is_active == True).all()
    best_stand = None
    best_distance = float('inf')
    
    for stand in stands:
        dist = haversine_distance(
            req.pickup_lat, req.pickup_lng,
            float(stand.latitude), float(stand.longitude),
        )
        if dist < best_distance:
            best_distance = dist
            best_stand = stand
    
    if not best_stand:
        raise HTTPException(status_code=404, detail="No auto stands found in your area")
    
    # Reverse-geocode pickup address if it's "Current Location"
    pickup_address = req.pickup_address
    if pickup_address.lower() in ["current location", "my location", ""]:
        try:
            resolved = await reverse_geocode(req.pickup_lat, req.pickup_lng)
            if resolved:
                # Extract short place name (first part before comma)
                pickup_address = resolved.split(",")[0].strip()
        except Exception:
            pickup_address = req.pickup_address
    
    # Calculate fare using nearest stand (use stand's zone for correct pricing)
    fare = calculate_fare(
        pickup_lat=req.pickup_lat, pickup_lng=req.pickup_lng,
        drop_lat=req.drop_lat, drop_lng=req.drop_lng,
        stand_lat=float(best_stand.latitude), stand_lng=float(best_stand.longitude),
        zone=best_stand.zone, db=db,
    )
    
    # Generate booking code and OTP
    booking_code = generate_booking_code()
    ride_otp = generate_otp()
    
    # Create ride record with status = 'pending' (NO driver assigned yet)
    ride = Ride(
        booking_code=booking_code,
        customer_id=customer_id,
        driver_id=None,  # Will be assigned by auto-assigner
        stand_id=best_stand.id,
        pickup_address=pickup_address,
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_address=req.drop_address,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        initial_dead_km=fare["initial_dead_km"],
        active_km=fare["active_km"],
        return_dead_km=fare["return_dead_km"],
        total_km=fare["total_km"],
        estimated_duration_min=fare["estimated_duration_min"],
        zone=fare["zone"],
        base_fare=fare["base_fare"],
        per_km_rate=fare["per_km_rate"],
        active_fare=fare["active_fare"],
        initial_dead_charge=fare["initial_dead_charge"],
        return_surcharge=fare["return_surcharge"],
        total_customer_fare=fare["total_customer_fare"],
        return_dead_compensation=fare["return_dead_compensation"],
        driver_earning=fare["driver_earning"],
        ap_commission=fare["ap_commission"],
        ride_otp=ride_otp,
        status="pending",  # Goes into pending pool for auto-assigner
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    
    # ── INSTANT DISPATCH: Try to assign a driver RIGHT NOW ──────────
    # Instead of waiting for the 2-min scheduler, attempt immediate match.
    # Priority: nearest driver → highest rating → lowest total rides today (load balance)
    instant_assigned = False
    try:
        now = get_ist_now()
        
        # Find all online drivers with GPS
        online_drivers = db.query(Driver).filter(
            Driver.is_online == True,
            Driver.current_lat.isnot(None),
            Driver.current_lng.isnot(None),
        ).all()
        
        # Filter out drivers already on active rides
        available_drivers = []
        for drv in online_drivers:
            active_ride = db.query(Ride).filter(
                Ride.driver_id == drv.id,
                Ride.status.in_(["offered", "accepted", "driver_arrived", "ride_started"])
            ).first()
            if not active_ride:
                available_drivers.append(drv)
        
        if available_drivers:
            # Score each driver: primary = distance, tiebreaker = rating (desc), then rides today (asc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            scored = []
            for drv in available_drivers:
                dist = haversine_distance(
                    req.pickup_lat, req.pickup_lng,
                    float(drv.current_lat), float(drv.current_lng),
                )
                if dist > 100:  # Skip if > 100km away
                    continue
                rides_today = db.query(Ride).filter(
                    Ride.driver_id == drv.id,
                    Ride.status == "ride_completed",
                    Ride.ride_completed_at >= today_start,
                ).count()
                # Sort: nearest first, then highest rating, then fewest rides today
                scored.append((dist, -(drv.rating or 0), rides_today, drv))
            
            scored.sort(key=lambda x: (x[0], x[1], x[2]))
            
            if scored:
                best = scored[0]
                best_driver = best[3]
                best_distance = best[0]
                
                # Assign the driver
                ride.driver_id = best_driver.id
                ride.status = "offered"
                
                offer = RideOffer(
                    ride_id=ride.id,
                    driver_id=best_driver.id,
                    expires_at=now + timedelta(seconds=30),
                    distance_to_pickup=best_distance,
                    response="pending",
                )
                db.add(offer)
                db.commit()
                
                instant_assigned = True
                
                driver_user = db.query(User).filter(User.id == best_driver.user_id).first()
                driver_name = driver_user.name if driver_user else f"Driver #{best_driver.id}"
                customer = db.query(User).filter(User.id == customer_id).first()
                customer_name = customer.name if customer else "Customer"
                
                print(f"  ⚡ INSTANT DISPATCH: Ride {ride.booking_code} → {driver_name} ({best_distance:.1f} km away)")
                
                # Push WebSocket notification to driver
                try:
                    await manager.send_personal_message({
                        "type": "NEW_RIDE_REQUEST",
                        "data": {
                            "ride_id": ride.id,
                            "pickup_address": ride.pickup_address,
                            "drop_address": ride.drop_address,
                            "distance_to_pickup": round(best_distance, 2),
                            "estimated_fare": float(ride.total_customer_fare or 0),
                            "driver_earning": float(ride.driver_earning or 0),
                            "customer_name": customer_name,
                        }
                    }, best_driver.user_id)
                    print(f"  📬 WebSocket push sent to {driver_name}")
                except Exception as ws_err:
                    print(f"  ⚠️ WebSocket push failed (driver can still poll): {ws_err}")
    except Exception as dispatch_err:
        print(f"  ⚠️ Instant dispatch failed (will retry via scheduler): {dispatch_err}")
        import traceback
        traceback.print_exc()
    # ── END INSTANT DISPATCH ────────────────────────────────────────
    
    return {
        "success": True,
        "data": {
            "ride_id": ride.id,
            "booking_code": ride.booking_code,
            "status": ride.status,
            "fare": fare,
            "otp": ride_otp,
            "message": "Driver found! Waiting for acceptance..." if instant_assigned else "Ride queued! Finding the best driver for you...",
        },
    }


@router.post("/{ride_id}/accept")
def accept_ride(
    ride_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver accepts a ride offer."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Find the ride offer for this driver
    offer = (
        db.query(RideOffer)
        .filter(
            RideOffer.ride_id == ride_id,
            RideOffer.driver_id == driver.id,
            RideOffer.response == "pending",
        )
        .first()
    )
    if not offer:
        raise HTTPException(status_code=404, detail="No pending ride offer found")
    
    # Check if expired
    if get_ist_now() > offer.expires_at.replace(tzinfo=timezone(timedelta(hours=5, minutes=30))):
        offer.response = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Ride offer has expired")
    
    # Accept the offer
    offer.response = "accepted"
    offer.responded_at = get_ist_now()
    
    # Update ride
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    ride.driver_id = driver.id
    ride.status = "accepted"
    ride.accepted_at = get_ist_now()
    
    # Remove driver from stand queue
    db.query(StandQueue).filter(StandQueue.driver_id == driver.id).delete()
    driver.current_stand_id = None
    
    db.commit()
    
    # Get customer info for driver
    customer = db.query(User).filter(User.id == ride.customer_id).first()
    
    return {
        "success": True,
        "message": "Ride accepted! Navigate to pickup.",
        "data": {
            "ride_id": ride.id,
            "booking_code": ride.booking_code,
            "pickup_address": ride.pickup_address,
            "pickup_lat": float(ride.pickup_lat),
            "pickup_lng": float(ride.pickup_lng),
            "drop_address": ride.drop_address,
            "drop_lat": float(ride.drop_lat),
            "drop_lng": float(ride.drop_lng),
            "customer_name": customer.name if customer else "Customer",
            "customer_phone": customer.phone_number if customer else None,
            "fare": float(ride.total_customer_fare),
            "driver_earning": float(ride.driver_earning),
        },
    }


@router.post("/{ride_id}/reject")
def reject_ride(
    ride_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver rejects a ride offer. Offer goes to next driver in queue."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Mark offer as rejected
    offer = (
        db.query(RideOffer)
        .filter(RideOffer.ride_id == ride_id, RideOffer.driver_id == driver.id)
        .first()
    )
    if offer:
        offer.response = "rejected"
        offer.responded_at = get_ist_now()
    
    # Update driver stats
    driver.rejection_count = (driver.rejection_count or 0) + 1
    total_offers = db.query(RideOffer).filter(RideOffer.driver_id == driver.id).count()
    rejections = db.query(RideOffer).filter(
        RideOffer.driver_id == driver.id, RideOffer.response == "rejected"
    ).count()
    if total_offers > 0:
        driver.acceptance_rate = round(((total_offers - rejections) / total_offers) * 100, 2)
    
    # Make driver available again in queue
    queue_entry = db.query(StandQueue).filter(StandQueue.driver_id == driver.id).first()
    if queue_entry:
        queue_entry.is_available = True
    
    # Try next driver in queue at the same stand
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if ride and ride.stand_id:
        next_driver = (
            db.query(StandQueue)
            .filter(
                StandQueue.stand_id == ride.stand_id,
                StandQueue.is_available == True,
                StandQueue.driver_id != driver.id,
            )
            .order_by(StandQueue.queue_position)
            .first()
        )
        
        if next_driver:
            # Offer to next driver
            new_offer = RideOffer(
                ride_id=ride.id,
                driver_id=next_driver.driver_id,
                stand_id=ride.stand_id,
                expires_at=get_ist_now() + timedelta(seconds=60),
                distance_to_pickup=float(ride.initial_dead_km or 0),
            )
            db.add(new_offer)
            next_driver.is_available = False
        else:
            # No more drivers available
            ride.status = "no_driver_found"
    
    db.commit()
    
    return {"success": True, "message": "Ride rejected. Offered to next driver."}


@router.post("/{ride_id}/arrived")
def driver_arrived(
    ride_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver marks they've arrived at pickup location."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.driver_id == driver.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride.status = "driver_arrived"
    ride.driver_arrived_at = get_ist_now()
    db.commit()
    
    return {
        "success": True,
        "message": "Marked as arrived. Ask customer for OTP to start ride.",
        "ride_otp": ride.ride_otp,
    }


@router.post("/{ride_id}/start")
def start_ride(
    ride_id: int,
    otp: str,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver verifies OTP and starts the ride."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.driver_id == driver.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if otp != ride.ride_otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    ride.status = "ride_started"
    ride.ride_started_at = get_ist_now()
    db.commit()
    
    return {
        "success": True,
        "message": "Ride started! Navigate to drop location.",
        "data": {
            "drop_address": ride.drop_address,
            "drop_lat": float(ride.drop_lat),
            "drop_lng": float(ride.drop_lng),
        },
    }


@router.post("/{ride_id}/complete")
async def complete_ride(
    ride_id: int,
    current_user: dict = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    """Driver completes the ride. Generates QR for payment."""
    driver = db.query(Driver).filter(Driver.user_id == current_user["user_id"]).first()
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.driver_id == driver.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride.status = "ride_completed"
    ride.ride_completed_at = get_ist_now()
    ride.payment_status = "pending"
    
    # Update driver stats
    driver.total_rides = (driver.total_rides or 0) + 1
    
    db.commit()
    
    # Generate QR payment data for driver to display
    qr_data = json.dumps({
        "ride_id": ride.id,
        "booking_code": ride.booking_code,
        "amount": float(ride.total_customer_fare),
        "driver_earning": float(ride.driver_earning),
    })
    
    # Notify customer via WebSocket that ride is complete and payment is needed
    try:
        await manager.send_personal_message({
            "type": "RIDE_COMPLETED",
            "data": {
                "ride_id": ride.id,
                "booking_code": ride.booking_code,
                "total_fare": float(ride.total_customer_fare),
                "driver_earning": float(ride.driver_earning),
            }
        }, ride.customer_id)
    except Exception:
        pass  # Customer will discover via polling
    
    return {
        "success": True,
        "message": f"Ride completed! Show QR to customer for payment.",
        "data": {
            "booking_code": ride.booking_code,
            "total_fare": float(ride.total_customer_fare),
            "driver_earning": float(ride.driver_earning),
            "payment_method": ride.payment_method,
            "qr_data": qr_data,
            "breakdown": {
                "base_fare": float(ride.base_fare),
                "active_fare": float(ride.active_fare),
                "initial_dead_charge": float(ride.initial_dead_charge),
                "return_surcharge": float(ride.return_surcharge),
                "return_dead_compensation": float(ride.return_dead_compensation),
            },
        },
    }


@router.post("/{ride_id}/rate")
def rate_ride(
    ride_id: int,
    req: RateRideRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer rates the ride (1-5 stars)."""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    ride.customer_rating = req.rating
    ride.customer_feedback = req.feedback
    
    # Update driver's average rating
    if ride.driver_id:
        driver = db.query(Driver).filter(Driver.id == ride.driver_id).first()
        if driver:
            # Calculate new average
            all_ratings = (
                db.query(Ride.customer_rating)
                .filter(Ride.driver_id == driver.id, Ride.customer_rating.isnot(None))
                .all()
            )
            ratings = [r[0] for r in all_ratings]
            ratings.append(req.rating)
            driver.rating = round(sum(ratings) / len(ratings), 2)
    
    db.commit()
    
    return {"success": True, "message": "Thanks for rating!"}


@router.get("/active/me")
def get_active_ride(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the currently active ride for a user (driver or customer)."""
    user_id = current_user["user_id"]
    role = current_user["role"]
    
    if role == "driver":
        driver = db.query(Driver).filter(Driver.user_id == user_id).first()
        if not driver:
            return {"success": True, "data": None}
            
        ride = db.query(Ride).filter(
            Ride.driver_id == driver.id,
            Ride.status.in_(["accepted", "driver_arrived", "ride_started"])
        ).first()
    else:
        ride = db.query(Ride).filter(
            Ride.customer_id == user_id,
            Ride.status.in_(["searching", "offered", "accepted", "driver_arrived", "ride_started"])
        ).first()
        
    if not ride:
        return {"success": True, "data": None}
        
    return {"success": True, "data": {
        "id": ride.id,
        "booking_code": ride.booking_code,
        "status": ride.status,
        "pickup_address": ride.pickup_address,
        "pickup_lat": float(ride.pickup_lat),
        "pickup_lng": float(ride.pickup_lng),
        "drop_address": ride.drop_address,
        "drop_lat": float(ride.drop_lat),
        "drop_lng": float(ride.drop_lng),
        "estimated_duration_min": ride.estimated_duration_min,
        "total_customer_fare": float(ride.total_customer_fare or 0),
        "ride_otp": ride.ride_otp if role == "driver" else None, # Only driver gets OTP
    }}


@router.get("/{ride_id}")
def get_ride(
    ride_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get ride details."""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    result = {
        "id": ride.id,
        "booking_code": ride.booking_code,
        "status": ride.status,
        "pickup_address": ride.pickup_address,
        "pickup_lat": float(ride.pickup_lat),
        "pickup_lng": float(ride.pickup_lng),
        "drop_address": ride.drop_address,
        "drop_lat": float(ride.drop_lat),
        "drop_lng": float(ride.drop_lng),
        "active_km": float(ride.active_km or 0),
        "estimated_duration_min": ride.estimated_duration_min,
        "total_customer_fare": float(ride.total_customer_fare or 0),
        "driver_earning": float(ride.driver_earning or 0),
        "payment_method": ride.payment_method,
        "payment_status": ride.payment_status,
        "ride_otp": ride.ride_otp,
        "customer_rating": ride.customer_rating,
        "requested_at": str(ride.requested_at) if ride.requested_at else None,
        "accepted_at": str(ride.accepted_at) if ride.accepted_at else None,
        "ride_started_at": str(ride.ride_started_at) if ride.ride_started_at else None,
        "ride_completed_at": str(ride.ride_completed_at) if ride.ride_completed_at else None,
    }
    
    # Include driver info if assigned
    if ride.driver_id:
        driver = db.query(Driver).filter(Driver.id == ride.driver_id).first()
        if driver:
            driver_user = db.query(User).filter(User.id == driver.user_id).first()
            result["driver"] = {
                "id": driver.id,
                "name": driver_user.name if driver_user else "Driver",
                "phone": driver_user.phone_number if driver_user else None,
                "vehicle_registration": driver.vehicle_registration,
                "vehicle_make": driver.vehicle_make,
                "vehicle_model": driver.vehicle_model,
                "rating": float(driver.rating) if driver.rating else 5.0,
                "current_lat": float(driver.current_lat) if driver.current_lat else None,
                "current_lng": float(driver.current_lng) if driver.current_lng else None,
            }
    
    return {"success": True, "data": result}


@router.get("/history/me")
def get_ride_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get ride history for the current user."""
    user_id = current_user["user_id"]
    role = current_user["role"]
    
    if role == "driver":
        driver = db.query(Driver).filter(Driver.user_id == user_id).first()
        if not driver:
            return {"success": True, "data": [], "count": 0}
        rides = (
            db.query(Ride)
            .filter(Ride.driver_id == driver.id)
            .order_by(Ride.created_at.desc())
            .limit(50)
            .all()
        )
    else:
        rides = (
            db.query(Ride)
            .filter(Ride.customer_id == user_id)
            .order_by(Ride.created_at.desc())
            .limit(50)
            .all()
        )
    
    result = []
    for ride in rides:
        result.append({
            "id": ride.id,
            "booking_code": ride.booking_code,
            "status": ride.status,
            "pickup_address": ride.pickup_address,
            "drop_address": ride.drop_address,
            "active_km": float(ride.active_km or 0),
            "total_customer_fare": float(ride.total_customer_fare or 0),
            "driver_earning": float(ride.driver_earning or 0),
            "customer_rating": ride.customer_rating,
            "payment_method": ride.payment_method,
            "requested_at": str(ride.requested_at) if ride.requested_at else None,
            "ride_completed_at": str(ride.ride_completed_at) if ride.ride_completed_at else None,
        })
    
    return {"success": True, "data": result, "count": len(result)}


@router.get("/ops/overview")
def ops_overview(db: Session = Depends(get_db)):
    """
    Operations Dashboard overview — no auth required (internal tool).
    Returns global KPIs and recent rides for TODAY only.
    """
    from sqlalchemy import func as sql_func
    
    today_start = get_ist_now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Auto-expire old stale rides from previous days (cleanup)
    stale_rides = db.query(Ride).filter(
        Ride.status.in_(["pending", "offered"]),
        Ride.created_at < today_start,
    ).all()
    for r in stale_rides:
        r.status = "cancelled"
        r.cancellation_reason = "Auto-expired (previous day)"
    if stale_rides:
        db.commit()
    
    # KPIs
    online_drivers = db.query(Driver).filter(Driver.is_online == True).count()
    total_drivers = db.query(Driver).count()
    active_rides = db.query(Ride).filter(
        Ride.status.in_(["offered", "accepted", "driver_arrived", "ride_started"]),
        Ride.created_at >= today_start,
    ).count()
    
    completed_today = db.query(Ride).filter(
        Ride.status == "ride_completed",
        Ride.ride_completed_at >= today_start,
    ).count()
    
    revenue_today = db.query(sql_func.coalesce(sql_func.sum(Ride.total_customer_fare), 0)).filter(
        Ride.status == "ride_completed",
        Ride.ride_completed_at >= today_start,
    ).scalar()
    
    # Recent rides — TODAY only (last 50)
    recent = (
        db.query(Ride)
        .filter(Ride.created_at >= today_start)
        .order_by(Ride.created_at.desc())
        .limit(50)
        .all()
    )
    
    rides_list = []
    for ride in recent:
        driver_name = None
        if ride.driver_id:
            driver = db.query(Driver).filter(Driver.id == ride.driver_id).first()
            if driver:
                user = db.query(User).filter(User.id == driver.user_id).first()
                driver_name = user.name if user else "Driver"
        
        customer = db.query(User).filter(User.id == ride.customer_id).first()
        
        rides_list.append({
            "id": ride.id,
            "booking_code": ride.booking_code,
            "status": ride.status,
            "pickup_address": ride.pickup_address,
            "drop_address": ride.drop_address,
            "total_customer_fare": float(ride.total_customer_fare or 0),
            "driver_name": driver_name,
            "customer_name": customer.name if customer else "Customer",
            "created_at": str(ride.created_at) if ride.created_at else None,
            "ride_completed_at": str(ride.ride_completed_at) if ride.ride_completed_at else None,
        })
    
    pending_rides = db.query(Ride).filter(Ride.status == "pending").count()
    
    return {
        "success": True,
        "data": {
            "kpis": {
                "online_drivers": online_drivers,
                "total_drivers": total_drivers,
                "pending_rides": pending_rides,
                "active_rides": active_rides,
                "completed_today": completed_today,
                "revenue_today": float(revenue_today),
            },
            "recent_rides": rides_list,
        }
    }


@router.post("/{ride_id}/create-payment")
def create_payment_order(
    ride_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Razorpay order for the ride payment.
    Called by the customer app after scanning QR or viewing payment screen.
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != "ride_completed":
        raise HTTPException(status_code=400, detail="Ride not yet completed")
    if ride.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    
    amount_paise = int(float(ride.total_customer_fare) * 100)  # Razorpay uses paise
    
    # Check if Razorpay is configured
    razorpay_key_id = getattr(Config, 'RAZORPAY_KEY_ID', None)
    razorpay_key_secret = getattr(Config, 'RAZORPAY_KEY_SECRET', None)
    
    if razorpay_key_id and razorpay_key_secret:
        import razorpay
        client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"ride_{ride.id}_{ride.booking_code}",
            "notes": {
                "ride_id": ride.id,
                "booking_code": ride.booking_code,
            }
        })
        
        # Save transaction
        txn = Transaction(
            ride_id=ride.id,
            customer_id=ride.customer_id,
            driver_id=ride.driver_id,
            amount=float(ride.total_customer_fare),
            payment_method="razorpay",
            status="pending",
            gateway_order_id=order["id"],
        )
        db.add(txn)
        db.commit()
        
        return {
            "success": True,
            "data": {
                "order_id": order["id"],
                "amount": amount_paise,
                "currency": "INR",
                "key_id": razorpay_key_id,
                "booking_code": ride.booking_code,
                "description": f"AP Auto Ride - {ride.booking_code}",
            }
        }
    else:
        # Razorpay not configured - use cash fallback
        return {
            "success": True,
            "data": {
                "payment_mode": "cash",
                "amount": float(ride.total_customer_fare),
                "booking_code": ride.booking_code,
                "message": "Pay cash to driver",
            }
        }


@router.post("/{ride_id}/verify-payment")
def verify_payment(
    ride_id: int,
    req: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify Razorpay payment signature and mark ride as paid.
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    razorpay_key_secret = getattr(Config, 'RAZORPAY_KEY_SECRET', None)
    if not razorpay_key_secret:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    # Verify signature
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_signature = hmac.new(
        razorpay_key_secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    
    # Update ride payment
    ride.payment_status = "paid"
    ride.payment_method = "razorpay"
    
    # Update transaction
    txn = db.query(Transaction).filter(
        Transaction.ride_id == ride.id,
        Transaction.gateway_order_id == req.razorpay_order_id,
    ).first()
    if txn:
        txn.status = "paid"
        txn.gateway_payment_id = req.razorpay_payment_id
        txn.paid_at = get_ist_now()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Payment successful!",
        "data": {
            "ride_id": ride.id,
            "amount_paid": float(ride.total_customer_fare),
            "payment_id": req.razorpay_payment_id,
        }
    }


@router.post("/{ride_id}/pay-cash")
def pay_cash(
    ride_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark ride as paid by cash."""
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride.payment_status = "paid"
    ride.payment_method = "cash"
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Cash payment of ₹{float(ride.total_customer_fare):.0f} confirmed.",
    }
