"""
AP Rides — Helper Utilities
Random code generators, OTP generators, distance calculations, etc.
"""
import random
import string
import math
from datetime import datetime, timezone, timedelta


def generate_booking_code() -> str:
    """
    Generate a unique booking code like 'AP-4X7K'.
    Format: AP- followed by 4 alphanumeric characters (uppercase).
    """
    chars = string.ascii_uppercase + string.digits
    code = "".join(random.choices(chars, k=4))
    return f"AP-{code}"


def generate_otp() -> str:
    """Generate a 4-digit OTP string."""
    return str(random.randint(1000, 9999))


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate straight-line distance between two GPS points in kilometers.
    Uses the Haversine formula.
    
    Args:
        lat1, lon1: First point (latitude, longitude in degrees)
        lat2, lon2: Second point (latitude, longitude in degrees)
    
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = (math.sin(dlat / 2) ** 2
         + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return round(R * c, 2)


def get_ist_now() -> datetime:
    """Get current time in IST (Indian Standard Time)."""
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist)


def format_fare(amount: float) -> str:
    """Format amount as Indian Rupees string: ₹180.00"""
    return f"₹{amount:.2f}"


# ── i18n: Multi-language strings ──────────────────────────

STRINGS = {
    "en": {
        "ride_requested": "Your ride has been requested! Finding a driver...",
        "driver_found": "Driver found! {driver_name} is on the way.",
        "driver_arrived": "Your driver has arrived at pickup point.",
        "ride_started": "Ride started! Enjoy your journey.",
        "ride_completed": "Ride completed! Fare: {fare}",
        "no_driver_found": "Sorry, no drivers available nearby. Please try again.",
        "ride_cancelled": "Your ride has been cancelled.",
        "otp_message": "Your ride OTP is: {otp}. Share this with your driver.",
        "welcome": "Welcome to AP Rides!",
    },
    "kn": {
        "ride_requested": "ನಿಮ್ಮ ಸವಾರಿ ವಿನಂತಿಸಲಾಗಿದೆ! ಚಾಲಕರನ್ನು ಹುಡುಕುತ್ತಿದ್ದೇವೆ...",
        "driver_found": "ಚಾಲಕ ಸಿಕ್ಕಿದ್ದಾರೆ! {driver_name} ಬರುತ್ತಿದ್ದಾರೆ.",
        "driver_arrived": "ನಿಮ್ಮ ಚಾಲಕ ಪಿಕಪ್ ಸ್ಥಳಕ್ಕೆ ಬಂದಿದ್ದಾರೆ.",
        "ride_started": "ಸವಾರಿ ಪ್ರಾರಂಭವಾಗಿದೆ! ನಿಮ್ಮ ಪ್ರಯಾಣ ಆನಂದಿಸಿ.",
        "ride_completed": "ಸವಾರಿ ಪೂರ್ಣಗೊಂಡಿದೆ! ಶುಲ್ಕ: {fare}",
        "no_driver_found": "ಕ್ಷಮಿಸಿ, ಹತ್ತಿರದಲ್ಲಿ ಚಾಲಕರು ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.",
        "ride_cancelled": "ನಿಮ್ಮ ಸವಾರಿ ರದ್ದಾಗಿದೆ.",
        "otp_message": "ನಿಮ್ಮ ಸವಾರಿ OTP: {otp}. ಇದನ್ನು ನಿಮ್ಮ ಚಾಲಕರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ.",
        "welcome": "AP Rides ಗೆ ಸ್ವಾಗತ!",
    },
    "hi": {
        "ride_requested": "आपकी सवारी का अनुरोध किया गया है! ड्राइवर ढूंढ रहे हैं...",
        "driver_found": "ड्राइवर मिल गया! {driver_name} रास्ते में हैं.",
        "driver_arrived": "आपका ड्राइवर पिकअप पॉइंट पर पहुंच गया है.",
        "ride_started": "सवारी शुरू हो गई! अपनी यात्रा का आनंद लें.",
        "ride_completed": "सवारी पूरी हो गई! किराया: {fare}",
        "no_driver_found": "क्षमा करें, आस-पास कोई ड्राइवर उपलब्ध नहीं है। कृपया पुनः प्रयास करें.",
        "ride_cancelled": "आपकी सवारी रद्द कर दी गई है.",
        "otp_message": "आपका सवारी OTP है: {otp}. इसे अपने ड्राइवर के साथ साझा करें.",
        "welcome": "AP Rides में आपका स्वागत है!",
    },
}


def get_string(key: str, lang: str = "en", **kwargs) -> str:
    """
    Get a translated string by key.
    
    Args:
        key: String key (e.g., 'ride_requested')
        lang: Language code ('en', 'kn', 'hi')
        **kwargs: Format variables (e.g., driver_name="Ramesh", fare="₹180")
    
    Returns:
        Translated and formatted string
    """
    lang_strings = STRINGS.get(lang, STRINGS["en"])
    template = lang_strings.get(key, STRINGS["en"].get(key, key))
    
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
