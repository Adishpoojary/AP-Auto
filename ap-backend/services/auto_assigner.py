"""
🛺 AP Rides — Auto Assigner Service
Runs every 2 minutes to assign pending rides to nearest available drivers.
Now with WebSocket push so drivers get instant notifications!

Key behaviors:
- Driver gets 30 seconds to accept an offer
- If expired, that driver is skipped on future cycles for the same ride
- After midnight, all stale pending/offered rides are auto-cancelled
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from utils.database import SessionLocal
from utils.helpers import get_ist_now, haversine_distance
from models.models import Ride, RideOffer, Driver, User


def run_assignment_cycle():
    """
    Main assignment cycle. Called every 2 minutes by APScheduler.
    
    Logic:
    1. Find all rides with status = 'pending' (not yet assigned)
    2. For each pending ride, find the nearest online driver who:
       - Is online
       - Has GPS coordinates
       - Doesn't already have an active ride
       - Hasn't already rejected this ride
    3. Create a RideOffer and set ride status to 'offered'
    4. Push WebSocket notification to driver app
    """
    db: Session = SessionLocal()
    try:
        now = get_ist_now()
        print(f"🔄 Auto-Assigner cycle starting at {now.strftime('%H:%M:%S')}")
        
        # ── Step -1: Midnight cleanup — cancel stale rides from previous days ──
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        stale_rides = db.query(Ride).filter(
            Ride.status.in_(["pending", "offered"]),
            Ride.created_at < today_start,
        ).all()
        
        for stale in stale_rides:
            stale.status = "cancelled"
            stale.cancelled_at = now
            stale.cancellation_reason = "Auto-expired (previous day)"
            # Also expire any pending offers for these stale rides
            stale_offers = db.query(RideOffer).filter(
                RideOffer.ride_id == stale.id,
                RideOffer.response == "pending",
            ).all()
            for so in stale_offers:
                so.response = "expired"
            print(f"  🧹 Stale ride {stale.booking_code} (from previous day) → cancelled")
        
        if stale_rides:
            db.commit()
        
        # ── Step 0: Expire old stale offers first ─────────────
        expired_offers = db.query(RideOffer).filter(
            RideOffer.response == "pending",
            RideOffer.expires_at < now,
        ).all()
        
        for offer in expired_offers:
            offer.response = "expired"
            ride = db.query(Ride).filter(Ride.id == offer.ride_id).first()
            if ride and ride.status == "offered":
                ride.status = "pending"  # Put back in the pool
                ride.driver_id = None
                print(f"  ⏰ Offer expired for ride {ride.booking_code}. Back to pending pool.")
        
        if expired_offers:
            db.commit()
        
        # ── Step 1: Find all pending rides ────────────────────
        pending_rides = db.query(Ride).filter(
            Ride.status == "pending"
        ).order_by(Ride.created_at.asc()).all()
        
        if not pending_rides:
            print("  ✅ No pending rides. Cycle complete.")
            return
        
        print(f"  📋 Found {len(pending_rides)} pending ride(s)")
        
        # ── Step 2: Find all available drivers ────────────────
        online_drivers = db.query(Driver).filter(
            Driver.is_online == True,
            Driver.current_lat.isnot(None),
            Driver.current_lng.isnot(None),
        ).all()
        
        # Filter out drivers with active rides
        available_drivers = []
        for driver in online_drivers:
            active_ride = db.query(Ride).filter(
                Ride.driver_id == driver.id,
                Ride.status.in_(["offered", "accepted", "driver_arrived", "ride_started"])
            ).first()
            if not active_ride:
                available_drivers.append(driver)
        
        print(f"  🛺 {len(available_drivers)} driver(s) available (of {len(online_drivers)} online)")
        
        if not available_drivers:
            print("  ⚠️ No available drivers. Pending rides will wait for next cycle.")
            return
        
        # ── Step 3: Assign each pending ride ──────────────────
        assigned_count = 0
        assigned_driver_ids = set()  # Track drivers assigned this cycle
        ws_notifications = []  # Collect WebSocket notifications to send
        
        for ride in pending_rides:
            # Find drivers who already rejected OR had expired offers for this ride
            # This prevents the same driver from being re-offered a trip they ignored
            skip_driver_ids = set()
            past_offers = db.query(RideOffer).filter(
                RideOffer.ride_id == ride.id,
                RideOffer.response.in_(["rejected", "expired"])
            ).all()
            for offer in past_offers:
                skip_driver_ids.add(offer.driver_id)
            
            # Find nearest available driver (excluding rejected + already assigned this cycle)
            best_driver = None
            best_distance = float('inf')
            
            for driver in available_drivers:
                if driver.id in skip_driver_ids:
                    continue
                if driver.id in assigned_driver_ids:
                    continue
                    
                dist = haversine_distance(
                    float(ride.pickup_lat), float(ride.pickup_lng),
                    float(driver.current_lat), float(driver.current_lng),
                )
                
                if dist < best_distance and dist <= 100:  # 100km for testing
                    best_distance = dist
                    best_driver = driver
            
            if not best_driver:
                print(f"  ❌ Ride {ride.booking_code}: No suitable driver found. Will retry next cycle.")
                continue
            
            # ── Assign the driver ─────────────────────────────
            ride.driver_id = best_driver.id
            ride.status = "offered"
            
            # Create ride offer
            offer = RideOffer(
                ride_id=ride.id,
                driver_id=best_driver.id,
                expires_at=now + timedelta(seconds=30),  # 30 sec to respond
                distance_to_pickup=best_distance,
                response="pending",
            )
            db.add(offer)
            
            assigned_driver_ids.add(best_driver.id)
            assigned_count += 1
            
            # Get customer info for the notification
            customer = db.query(User).filter(User.id == ride.customer_id).first()
            customer_name = customer.name if customer and customer.name else "Customer"
            
            user = db.query(User).filter(User.id == best_driver.user_id).first()
            driver_name = user.name if user else f"Driver #{best_driver.id}"
            print(
                f"  ✅ Ride {ride.booking_code} → {driver_name} "
                f"({best_distance:.1f} km away)"
            )
            
            # Queue WebSocket notification for this driver
            ws_notifications.append({
                "driver_user_id": best_driver.user_id,
                "message": {
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
                }
            })
        
        db.commit()
        print(f"🔄 Auto-Assigner cycle complete: {assigned_count}/{len(pending_rides)} rides assigned")
        
        # ── Step 4: Send WebSocket notifications to drivers ───
        if ws_notifications:
            try:
                from api.dispatch.ws import manager
                loop = None
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = None
                
                for notif in ws_notifications:
                    driver_uid = notif["driver_user_id"]
                    msg = notif["message"]
                    
                    if loop and loop.is_running():
                        # We're inside an async context, schedule the coroutine
                        asyncio.ensure_future(manager.send_personal_message(msg, driver_uid))
                    else:
                        # We're in a sync context (APScheduler thread), create a new loop
                        try:
                            asyncio.run(manager.send_personal_message(msg, driver_uid))
                        except RuntimeError:
                            # If there's an event loop issue, try with new_event_loop
                            new_loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(new_loop)
                            new_loop.run_until_complete(manager.send_personal_message(msg, driver_uid))
                            new_loop.close()
                    
                    print(f"  📬 WebSocket push sent to driver user_id={driver_uid}")
                    
            except Exception as e:
                print(f"  ⚠️ WebSocket push failed (driver can still poll): {e}")
        
    except Exception as e:
        print(f"❌ Auto-Assigner error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
