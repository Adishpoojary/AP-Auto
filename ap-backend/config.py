"""
AP Rides — Configuration
Loads settings from .env file with sensible defaults for development.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration for AP Rides backend."""

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:aprides123@localhost:5432/ap_db",
    )

    # ── JWT Authentication ────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "ap-rides-dev-secret-change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "43200"))  # 30 days

    # ── Google Maps ───────────────────────────────────────────
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # ── Firebase ──────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-key.json")

    # ── Cloudinary ────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # ── App Settings ──────────────────────────────────────────
    APP_NAME: str = os.getenv("APP_NAME", "AP Rides")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ── Ride Settings ─────────────────────────────────────────
    RIDE_OFFER_TIMEOUT_SECONDS: int = int(os.getenv("RIDE_OFFER_TIMEOUT_SECONDS", "60"))
    MAX_STAND_SEARCH_RADIUS_KM: float = float(os.getenv("MAX_STAND_SEARCH_RADIUS_KM", "5"))
    MAX_RIDE_OFFERS_PER_RIDE: int = int(os.getenv("MAX_RIDE_OFFERS_PER_RIDE", "10"))

    # ── Dev OTP (for development only!) ───────────────────────
    DEV_OTP: str = os.getenv("DEV_OTP", "1234")

    # ── Razorpay Payment Gateway ──────────────────────────────
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")

    # ── Server ────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Supported Languages ───────────────────────────────────
    SUPPORTED_LANGUAGES = ["en", "kn", "hi"]  # English, Kannada, Hindi
