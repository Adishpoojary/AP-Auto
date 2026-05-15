"""
AP Rides — Authentication API Routes
Handles phone-based OTP login for both customers and drivers.

Flow:
  1. POST /auth/send-otp   → sends OTP to phone (dev: always "1234")
  2. POST /auth/verify-otp  → verifies OTP → returns JWT token
  3. GET  /auth/profile      → get current user profile
  4. PUT  /auth/profile      → update profile (name, language, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from utils.database import get_db
from utils.auth import create_access_token, get_current_user
from utils.helpers import generate_otp, get_ist_now
from config import Config
from models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Request/Response Models ──────────────────────────────

class SendOTPRequest(BaseModel):
    phone_number: int  # e.g., 9876543210

class VerifyOTPRequest(BaseModel):
    phone_number: int
    otp: str           # "1234" in dev mode
    role: str = "customer"  # "customer" or "driver"

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    preferred_language: Optional[str] = None  # "en", "kn", "hi"


# ── In-memory OTP store (dev only — replace with Redis/SMS in production) ──
_otp_store: dict[int, str] = {}


# ── Routes ───────────────────────────────────────────────

@router.post("/send-otp")
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    """
    Send OTP to a phone number.
    In development: always stores "1234" as the OTP.
    In production: would send SMS via MSG91/Twilio.
    """
    phone = req.phone_number

    # Validate phone number (Indian: 10 digits)
    if len(str(phone)) != 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number must be 10 digits (e.g., 9876543210)",
        )

    # In development, use fixed OTP
    if Config.APP_ENV == "development":
        otp = Config.DEV_OTP  # "1234"
    else:
        otp = generate_otp()

    # Store OTP (in production, use Redis with 5-min expiry)
    _otp_store[phone] = otp

    print(f"📱 OTP for {phone}: {otp}")  # Dev log

    return {
        "success": True,
        "message": f"OTP sent to {phone}",
        "dev_otp": otp if Config.DEBUG else None,  # Only show in debug mode
    }


@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify OTP and return JWT token.
    Creates user if first time, otherwise returns existing user.
    """
    phone = req.phone_number
    
    # Check OTP
    stored_otp = _otp_store.get(phone)
    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP found for this number. Request OTP first.",
        )

    if req.otp != stored_otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP. Please try again.",
        )

    # OTP verified — remove it
    del _otp_store[phone]

    # Check if user exists
    user = db.query(User).filter(User.phone_number == phone).first()

    if not user:
        # Create new user
        user = User(
            phone_number=phone,
            role=req.role,
            preferred_language="en",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True
    else:
        is_new_user = False

    # Create JWT token
    token = create_access_token(user_id=user.id, role=user.role)

    return {
        "success": True,
        "is_new_user": is_new_user,
        "token": token,
        "user": {
            "id": user.id,
            "phone_number": user.phone_number,
            "name": user.name,
            "role": user.role,
            "preferred_language": user.preferred_language,
            "profile_photo_url": user.profile_photo_url,
        },
    }


@router.get("/profile")
def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's profile."""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = {
        "id": user.id,
        "phone_number": user.phone_number,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "preferred_language": user.preferred_language,
        "profile_photo_url": user.profile_photo_url,
        "is_active": user.is_active,
        "created_at": str(user.created_at) if user.created_at else None,
    }

    # If user is a driver, include driver details
    if user.role == "driver":
        from models.models import Driver
        driver = db.query(Driver).filter(Driver.user_id == user.id).first()
        if driver:
            result["driver"] = {
                "driver_id": driver.id,
                "vehicle_registration": driver.vehicle_registration,
                "vehicle_make": driver.vehicle_make,
                "vehicle_model": driver.vehicle_model,
                "rating": float(driver.rating) if driver.rating else 5.0,
                "total_rides": driver.total_rides,
                "acceptance_rate": float(driver.acceptance_rate) if driver.acceptance_rate else 100.0,
                "verification_status": driver.verification_status,
                "is_online": driver.is_online,
            }

    return {"success": True, "data": result}


@router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile."""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.name is not None:
        user.name = req.name
    if req.email is not None:
        user.email = req.email
    if req.preferred_language is not None:
        if req.preferred_language not in Config.SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Language must be one of: {Config.SUPPORTED_LANGUAGES}",
            )
        user.preferred_language = req.preferred_language

    user.updated_at = get_ist_now()
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Profile updated",
        "data": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "preferred_language": user.preferred_language,
        },
    }
