import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import engine, Base, SessionLocal
from app.services.synthetic_generator import SyntheticDataGenerator

def main():
    print("=" * 60)
    print(" SatyaCheck (AICTE Trust Layer) — Database & Demo Seeder")
    print("=" * 60)
    
    # Create all tables
    print("Creating database schema...")
    Base.metadata.create_all(bind=engine)
    print("Schema created successfully.")
    
    db = SessionLocal()
    try:
        generator = SyntheticDataGenerator()
        print("\n1. Seeding Default RBAC Users...")
        generator.seed_default_users(db)
        
        print("\n2. Seeding 3 Hero Applications for Demo Tour...")
        generator.seed_hero_applications(db)
        
        print("\n3. Seeding 60 Synthetic Applications for Evaluation...")
        generator.seed_synthetic_evaluation_dataset(db, target_count=60)
        
        print("\n" + "=" * 60)
        print(" Demo Data Seeding Completed Successfully!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    main()
