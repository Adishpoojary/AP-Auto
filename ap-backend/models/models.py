"""
AP Rides — SQLAlchemy Models
All database models matching the init.sql schema.
"""
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean, DECIMAL, 
    TIMESTAMP, DATE, TIME, ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from utils.database import Base


# ══════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "users"}

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(BigInteger, unique=True, nullable=False, index=True)
    name = Column(String(100))
    email = Column(String(100))
    role = Column(String(20), nullable=False, default="customer")
    profile_photo_url = Column(Text)
    preferred_language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


# ══════════════════════════════════════════════════════════
# DRIVERS
# ══════════════════════════════════════════════════════════
class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = {"schema": "drivers"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.users.id", ondelete="CASCADE"))

    # Vehicle info
    vehicle_registration = Column(String(20), unique=True)
    vehicle_make = Column(String(50))
    vehicle_model = Column(String(50))
    vehicle_photo_url = Column(Text)

    # License
    license_number = Column(String(30))
    license_expiry = Column(DATE)

    # Documents
    documents = Column(JSONB, default={})

    # Performance
    rating = Column(DECIMAL(3, 2), default=5.00)
    total_rides = Column(Integer, default=0)
    acceptance_rate = Column(DECIMAL(5, 2), default=100.00)
    cancellation_count = Column(Integer, default=0)
    rejection_count = Column(Integer, default=0)

    # Verification
    verification_status = Column(String(20), default="pending")
    verified_at = Column(TIMESTAMP)
    rejection_reason = Column(Text)

    # Availability
    is_online = Column(Boolean, default=False)
    current_stand_id = Column(Integer, ForeignKey("stands.stands.id"))
    current_lat = Column(DECIMAL(9, 6))
    current_lng = Column(DECIMAL(9, 6))
    last_location_update = Column(TIMESTAMP)

    # Payment
    upi_id = Column(String(100))
    bank_account_no = Column(String(30))
    bank_ifsc = Column(String(15))
    bank_name = Column(String(100))

    # Push notifications
    fcm_token = Column(String(500))
    device_type = Column(String(10))

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


# ══════════════════════════════════════════════════════════
# STANDS
# ══════════════════════════════════════════════════════════
class Stand(Base):
    __tablename__ = "stands"
    __table_args__ = {"schema": "stands"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(Text)
    latitude = Column(DECIMAL(9, 6), nullable=False)
    longitude = Column(DECIMAL(9, 6), nullable=False)
    city = Column(String(50), nullable=False)
    zone = Column(String(20), default="urban")
    total_capacity = Column(Integer, default=20)
    opens_at = Column(TIME, default="06:00")
    closes_at = Column(TIME, default="22:00")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class StandQueue(Base):
    __tablename__ = "stand_queue"
    __table_args__ = (
        UniqueConstraint("stand_id", "driver_id"),
        {"schema": "stands"},
    )

    id = Column(Integer, primary_key=True, index=True)
    stand_id = Column(Integer, ForeignKey("stands.stands.id", ondelete="CASCADE"))
    driver_id = Column(Integer, ForeignKey("drivers.drivers.id", ondelete="CASCADE"))
    queue_position = Column(Integer, nullable=False)
    checked_in_at = Column(TIMESTAMP, server_default=func.now())
    is_available = Column(Boolean, default=True)


# ══════════════════════════════════════════════════════════
# RIDES
# ══════════════════════════════════════════════════════════
class Ride(Base):
    __tablename__ = "rides"
    __table_args__ = {"schema": "rides"}

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(10), unique=True, nullable=False, index=True)

    customer_id = Column(Integer, ForeignKey("users.users.id"))
    driver_id = Column(Integer, ForeignKey("drivers.drivers.id"))
    stand_id = Column(Integer, ForeignKey("stands.stands.id"))

    # Pickup
    pickup_address = Column(Text, nullable=False)
    pickup_lat = Column(DECIMAL(9, 6), nullable=False)
    pickup_lng = Column(DECIMAL(9, 6), nullable=False)

    # Drop
    drop_address = Column(Text, nullable=False)
    drop_lat = Column(DECIMAL(9, 6), nullable=False)
    drop_lng = Column(DECIMAL(9, 6), nullable=False)

    # Distances
    initial_dead_km = Column(DECIMAL(8, 2), default=0)
    active_km = Column(DECIMAL(8, 2), default=0)
    return_dead_km = Column(DECIMAL(8, 2), default=0)
    total_km = Column(DECIMAL(8, 2), default=0)
    estimated_duration_min = Column(Integer, default=0)

    # Times
    requested_at = Column(TIMESTAMP, server_default=func.now())
    accepted_at = Column(TIMESTAMP)
    driver_arrived_at = Column(TIMESTAMP)
    ride_started_at = Column(TIMESTAMP)
    ride_completed_at = Column(TIMESTAMP)
    cancelled_at = Column(TIMESTAMP)

    # Pricing
    zone = Column(String(20), default="urban")
    base_fare = Column(DECIMAL(8, 2), default=0)
    per_km_rate = Column(DECIMAL(8, 2), default=0)
    active_fare = Column(DECIMAL(8, 2), default=0)
    initial_dead_charge = Column(DECIMAL(8, 2), default=0)
    return_surcharge = Column(DECIMAL(8, 2), default=0)
    waiting_charge = Column(DECIMAL(8, 2), default=0)
    total_customer_fare = Column(DECIMAL(8, 2), default=0)
    
    return_dead_compensation = Column(DECIMAL(8, 2), default=0)
    driver_earning = Column(DECIMAL(8, 2), default=0)
    ap_commission = Column(DECIMAL(8, 2), default=0)

    # Status
    status = Column(String(30), default="requested")

    # OTP
    ride_otp = Column(String(4))

    # Ratings
    customer_rating = Column(Integer)
    driver_rating = Column(Integer)
    customer_feedback = Column(Text)

    # Payment
    payment_method = Column(String(20), default="cash")
    payment_status = Column(String(20), default="pending")

    cancellation_reason = Column(Text)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class RideOffer(Base):
    __tablename__ = "ride_offers"
    __table_args__ = {"schema": "rides"}

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("rides.rides.id", ondelete="CASCADE"))
    driver_id = Column(Integer, ForeignKey("drivers.drivers.id"))
    stand_id = Column(Integer, ForeignKey("stands.stands.id"))

    offered_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP, nullable=False)

    response = Column(String(20), default="pending")
    responded_at = Column(TIMESTAMP)
    distance_to_pickup = Column(DECIMAL(8, 2))


# ══════════════════════════════════════════════════════════
# PRICING
# ══════════════════════════════════════════════════════════
class ZonePricing(Base):
    __tablename__ = "zone_pricing"
    __table_args__ = {"schema": "pricing"}

    id = Column(Integer, primary_key=True, index=True)
    zone = Column(String(20), nullable=False)
    city = Column(String(50), default="Udupi")

    base_fare = Column(DECIMAL(8, 2), nullable=False, default=30)
    per_km_rate = Column(DECIMAL(8, 2), nullable=False, default=15)
    per_minute_wait = Column(DECIMAL(8, 2), nullable=False, default=2)

    initial_dead_flat = Column(DECIMAL(8, 2), default=25)
    initial_dead_per_km = Column(DECIMAL(8, 2), default=8)
    initial_dead_free_km = Column(DECIMAL(8, 2), default=2)

    return_dead_per_km = Column(DECIMAL(8, 2), default=5)
    return_dead_cap = Column(DECIMAL(8, 2), default=50)
    return_surcharge = Column(DECIMAL(8, 2), default=20)

    driver_share_pct = Column(DECIMAL(5, 2), default=80)
    ap_commission_pct = Column(DECIMAL(5, 2), default=20)

    min_fare = Column(DECIMAL(8, 2), default=50)

    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


# ══════════════════════════════════════════════════════════
# PAYMENTS
# ══════════════════════════════════════════════════════════
class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = {"schema": "payments"}

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("rides.rides.id"))
    customer_id = Column(Integer, ForeignKey("users.users.id"))
    driver_id = Column(Integer, ForeignKey("drivers.drivers.id"))

    amount = Column(DECIMAL(10, 2), nullable=False)
    payment_method = Column(String(20), default="cash")
    status = Column(String(20), default="pending")

    gateway_order_id = Column(String(100))
    gateway_payment_id = Column(String(100))

    paid_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
