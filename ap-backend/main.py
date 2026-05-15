"""
🛺 AP Rides — Main Application
Auto Rickshaw Booking Platform for Coastal Karnataka

Run with: python main.py
   or:    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import Config

# Create FastAPI app
app = FastAPI(
    title="AP Rides API",
    description="Auto Rickshaw Booking Platform for Udupi & Mangalore",
    version="0.1.0",
    docs_url="/docs",        # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",      # ReDoc at http://localhost:8000/redoc
)

# ── CORS (allow requests from mobile apps and dashboard) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API Routes ─────────────────────────────────
from api.auth.routes import router as auth_router
from api.drivers.routes import router as drivers_router
from api.stands.routes import router as stands_router
from api.rides.routes import router as rides_router
from api.bookings.routes import router as bookings_router
from api.dispatch.ws import router as dispatch_ws_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(drivers_router, prefix="/api/v1")
app.include_router(stands_router, prefix="/api/v1")
app.include_router(rides_router, prefix="/api/v1")
app.include_router(bookings_router, prefix="/api/v1")
app.include_router(dispatch_ws_router, prefix="/api/v1")


# ── Health Check ─────────────────────────────────────────
@app.get("/")
def root():
    return {
        "app": "AP Rides",
        "version": "0.1.0",
        "status": "running ✅",
        "docs": "http://localhost:8000/docs",
        "environment": Config.APP_ENV,
    }


# ── Auto-Assigner Scheduler ─────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from services.auto_assigner import run_assignment_cycle

scheduler = BackgroundScheduler()
scheduler.add_job(
    run_assignment_cycle,
    'interval',
    minutes=2,
    id='auto_assigner',
    name='AP Auto Assigner (2-min cycle)',
    max_instances=1,
    misfire_grace_time=60,
)

@app.on_event("startup")
def start_scheduler():
    """Start the 5-minute auto-assigner on server boot."""
    import logging
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    scheduler.start()
    # Run one cycle immediately on startup
    run_assignment_cycle()
    print("🔄 Auto-Assigner started (runs every 2 minutes)")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown(wait=False)
    print("🛑 Auto-Assigner stopped")


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    from sqlalchemy import text
    from utils.database import engine
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected ✅"
    except Exception as e:
        db_status = f"error ❌: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status,
        "environment": Config.APP_ENV,
    }


# ── Run Server ───────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("AP Rides Backend Starting...")
    print(f"Environment: {Config.APP_ENV}")
    print(f"Server: http://localhost:{Config.PORT}")
    print(f"API Docs: http://localhost:{Config.PORT}/docs")
    print("=" * 50)
    
    uvicorn.run(
        "main:app",
        host=Config.HOST,
        port=Config.PORT,
        reload=Config.DEBUG,     # Auto-reload on code changes in dev
        log_level="info",
    )
