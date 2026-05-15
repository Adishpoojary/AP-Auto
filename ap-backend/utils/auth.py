"""
AP Rides — JWT Authentication Utilities
Handles token creation, verification, and password-less phone auth.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from config import Config
from utils.database import get_db

# Security scheme — expects "Bearer <token>" in Authorization header
security = HTTPBearer()


def create_access_token(user_id: int, role: str) -> str:
    """
    Create a JWT token for a user.
    
    Args:
        user_id: The user's database ID
        role: 'customer' or 'driver'
    
    Returns:
        JWT token string
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=Config.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token.
    
    Returns:
        Decoded payload dict with 'sub' (user_id) and 'role'
    
    Raises:
        HTTPException 401 if token is invalid or expired
    """
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID",
            )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )


def verify_ws_token(token: str) -> dict:
    """
    Verify a token specifically for WebSockets without throwing HTTPException
    so we can close the socket properly with a WebSocket error code.
    """
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {
            "user_id": int(user_id),
            "role": payload.get("role")
        }
    except Exception:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """
    FastAPI dependency that extracts and validates the current user from JWT.
    
    Usage in routes:
        @app.get("/profile")
        def get_profile(current_user: dict = Depends(get_current_user)):
            user_id = current_user["user_id"]
            role = current_user["role"]
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    return {
        "user_id": int(payload["sub"]),
        "role": payload["role"],
    }


def require_role(required_role: str):
    """
    Factory for role-based access control.
    
    Usage:
        @app.get("/driver-only")
        def driver_route(user: dict = Depends(require_role("driver"))):
            ...
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}",
            )
        return current_user
    return role_checker
