"""
AP Rides — Bookings API Routes (Ops Dashboard)
List and manage ride bookings from the ops dashboard.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from utils.database import get_db
from models.models import Ride, User, Driver

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("")
def list_bookings(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    state: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List all ride bookings for the ops dashboard.
    Supports filtering by state, search, date range, and pagination.
    """
    query = db.query(Ride)

    # Filter by status
    if state:
        query = query.filter(Ride.status == state)

    # Search by booking code or pickup/drop address
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Ride.booking_code.ilike(search_term)) |
            (Ride.pickup_address.ilike(search_term)) |
            (Ride.drop_address.ilike(search_term))
        )

    # Date range filter
    if start_date:
        query = query.filter(Ride.created_at >= start_date)
    if end_date:
        query = query.filter(Ride.created_at <= f"{end_date} 23:59:59")

    # Get total count before pagination
    total = query.count()

    # Order by newest first, apply pagination
    rides = query.order_by(Ride.id.desc()).offset(offset).limit(limit).all()

    # Build response matching what the frontend Bookings.jsx expects
    bookings_list = []
    for ride in rides:
        # Get customer name
        customer = db.query(User).filter(User.id == ride.customer_id).first() if ride.customer_id else None
        # Get driver name
        driver = db.query(Driver).filter(Driver.id == ride.driver_id).first() if ride.driver_id else None
        driver_user = db.query(User).filter(User.id == driver.user_id).first() if driver else None

        bookings_list.append({
            "id": ride.id,
            "booking_code": ride.booking_code,
            "customer_name": customer.name if customer else "Walk-in",
            "customer_phone": str(customer.phone_number) if customer else None,
            "pickup_address": ride.pickup_address,
            "drop_addresses": [ride.drop_address] if ride.drop_address else [],
            "pickup_time": str(ride.requested_at) if ride.requested_at else None,
            "created_at": str(ride.created_at) if ride.created_at else None,
            "state": ride.status or "requested",
            "vehicle_class_id": 1,  # Auto rickshaw
            "payment_estimate": float(ride.total_customer_fare) if ride.total_customer_fare else 0,
            "actual_bill": float(ride.total_customer_fare) if ride.status == "ride_completed" and ride.total_customer_fare else None,
            "payment_id": None,
            "driver_name": driver_user.name if driver_user else None,
            "is_modifiable": ride.status in ("requested", "accepted"),
        })

    return {"bookings": bookings_list, "total": total}
