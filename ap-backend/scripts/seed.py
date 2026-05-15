import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from utils.database import SessionLocal
from models.models import Stand, ZonePricing
from datetime import time

def seed_database():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(ZonePricing).first():
            print("Database already seeded with pricing zones.")
        else:
            # Seed Pricing Zones
            zones = [
                ZonePricing(
                    zone="UDUPI_CITY",
                    city="Udupi",
                    base_fare=35.00,
                    per_km_rate=15.00,
                    per_minute_wait=1.00,
                    initial_dead_flat=10.00,
                    initial_dead_per_km=10.00,
                    initial_dead_free_km=1.5,
                    return_dead_per_km=12.00,
                    return_dead_cap=100.00,
                    return_surcharge=0.00,
                    driver_share_pct=95.00,
                    ap_commission_pct=5.00,
                    min_fare=35.00
                ),
                ZonePricing(
                    zone="MANIPAL",
                    city="Manipal",
                    base_fare=35.00,
                    per_km_rate=15.00,
                    per_minute_wait=1.00,
                    initial_dead_flat=10.00,
                    initial_dead_per_km=10.00,
                    initial_dead_free_km=1.5,
                    return_dead_per_km=12.00,
                    return_dead_cap=100.00,
                    return_surcharge=1.50,
                    driver_share_pct=95.00,
                    ap_commission_pct=5.00,
                    min_fare=40.00
                ),
                ZonePricing(
                    zone="MANGALORE_CITY",
                    city="Mangalore",
                    base_fare=40.00,
                    per_km_rate=17.00,
                    per_minute_wait=1.50,
                    initial_dead_flat=15.00,
                    initial_dead_per_km=12.00,
                    initial_dead_free_km=1.0,
                    return_dead_per_km=14.00,
                    return_dead_cap=150.00,
                    return_surcharge=0.00,
                    driver_share_pct=93.00,
                    ap_commission_pct=7.00,
                    min_fare=40.00
                )
            ]
            db.add_all(zones)
            db.commit()
            print("Successfully seeded pricing zones.")

        if db.query(Stand).first():
            print("Database already seeded with auto stands.")
        else:
            # Seed Udupi and Manipal Auto Stands
            stands = [
                Stand(name="Tiger Circle Auto Stand", address="Tiger Circle, Manipal, Karnataka 576104", latitude=13.3512, longitude=74.7865, city="Manipal", zone="MANIPAL", total_capacity=20, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="MIT Main Gate Auto Stand", address="MIT Main Gate, Manipal, Karnataka 576104", latitude=13.3524, longitude=74.7924, city="Manipal", zone="MANIPAL", total_capacity=15, opens_at=time(5, 0), closes_at=time(23, 0)),
                Stand(name="Syndicate Circle Stand", address="Syndicate Circle, Manipal, Karnataka 576104", latitude=13.3485, longitude=74.7821, city="Manipal", zone="MANIPAL", total_capacity=10, opens_at=time(6, 0), closes_at=time(22, 0)),
                Stand(name="KMC Hospital Auto Stand", address="KMC Hospital, Manipal, Karnataka 576104", latitude=13.3498, longitude=74.7845, city="Manipal", zone="MANIPAL", total_capacity=25, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="Udupi City Bus Stand (Main)", address="City Bus Stand, Udupi, Karnataka 576101", latitude=13.3361, longitude=74.7482, city="Udupi", zone="UDUPI_CITY", total_capacity=40, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="Service Bus Stand Auto Point", address="Service Bus Stand, Udupi, Karnataka 576101", latitude=13.3355, longitude=74.7470, city="Udupi", zone="UDUPI_CITY", total_capacity=30, opens_at=time(4, 0), closes_at=time(23, 30)),
                Stand(name="Udupi Railway Station Stand", address="Railway Station, Indrali, Udupi, Karnataka 576102", latitude=13.3448, longitude=74.7612, city="Udupi", zone="UDUPI_CITY", total_capacity=25, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="Sri Krishna Temple Auto Stand", address="Car Street, Udupi, Karnataka 576101", latitude=13.3392, longitude=74.7458, city="Udupi", zone="UDUPI_CITY", total_capacity=20, opens_at=time(5, 0), closes_at=time(22, 0)),
                Stand(name="MGM College Auto Stand", address="MGM College, Kunjibettu, Udupi, Karnataka 576102", latitude=13.3415, longitude=74.7570, city="Udupi", zone="UDUPI_CITY", total_capacity=10, opens_at=time(7, 0), closes_at=time(20, 0)),
                Stand(name="Malpe Beach Auto Stand", address="Malpe Beach, Udupi, Karnataka 576108", latitude=13.3551, longitude=74.7001, city="Udupi", zone="UDUPI_CITY", total_capacity=20, opens_at=time(6, 0), closes_at=time(21, 0)),
                Stand(name="Mangalore Central Station Stand", address="Railway Station Rd, Hampankatta, Mangaluru, Karnataka 575001", latitude=12.8643, longitude=74.8431, city="Mangalore", zone="MANGALORE_CITY", total_capacity=50, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="Mangalore Junction Stand", address="Padil, Mangaluru, Karnataka 575007", latitude=12.8715, longitude=74.8789, city="Mangalore", zone="MANGALORE_CITY", total_capacity=30, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="State Bank Bus Stand Auto Queue", address="State Bank, Hampankatta, Mangaluru, Karnataka 575001", latitude=12.8687, longitude=74.8385, city="Mangalore", zone="MANGALORE_CITY", total_capacity=40, opens_at=time(0, 0), closes_at=time(23, 0)),
                Stand(name="KSRTC Bejai Auto Stand", address="Bejai, Mangaluru, Karnataka 575004", latitude=12.8842, longitude=74.8465, city="Mangalore", zone="MANGALORE_CITY", total_capacity=35, opens_at=time(0, 0), closes_at=time(23, 59)),
                Stand(name="KMC Attavar Auto Stand", address="Attavar, Mangaluru, Karnataka 575001", latitude=12.8614, longitude=74.8458, city="Mangalore", zone="MANGALORE_CITY", total_capacity=15, opens_at=time(0, 0), closes_at=time(23, 59))
            ]
            db.add_all(stands)
            db.commit()
            print("Successfully seeded auto stands.")
            
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    load_dotenv()
    seed_database()
