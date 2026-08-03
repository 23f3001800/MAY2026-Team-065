import asyncio
from sqlalchemy.future import select
from database import AsyncSessionLocal
import models
import security

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Starting database seeding...")

        # Categories
        categories = [
            {"categoryId": "CAT-WAT-01", "name": "Water Leak / Pipe Burst", "department": "Water & Plumbing"},
            {"categoryId": "CAT-SAN-01", "name": "Garbage Collection / Debris", "department": "Sanitation"},
            {"categoryId": "CAT-ROA-01", "name": "Pothole / Road Damage", "department": "Roads & Transport"},
            {"categoryId": "CAT-ELE-01", "name": "Streetlight Outage", "department": "Electrical"},
            {"categoryId": "CAT-PUB-01", "name": "Park / Public Property Damage", "department": "Public Works"}
        ]

        stmt = select(models.CategoryModel)
        result = await db.execute(stmt)
        existing_categories = result.scalars().all()

        if not existing_categories:
            for cat in categories:
                db_category = models.CategoryModel(**cat)
                db.add(db_category)
            print(f"Added {len(categories)} municipal categories.")
        else:
            print(" Categories already exist. Skipping category insertion.")

        # Super Admin
        admin_email = "admin@city.gov"
        stmt = select(models.UserModel).where(models.UserModel.email == admin_email)
        result = await db.execute(stmt)
        existing_admin = result.scalar_one_or_none()

        if not existing_admin:
            hashed_pw = security.get_password_hash("admin123")
            
            db_admin = models.AdministratorModel(
                userId="admin-0001",
                name="System Administrator",
                email=admin_email,
                phone="+18005550000",
                passwordHash=hashed_pw,
                role="administrator",
                accessLevel="SUPER"
            )
            db.add(db_admin)
            print("Created default Super Admin account.")
            print("Email: admin@city.gov")
            print("Password: admin123")
        else:
             print(" Admin account already exists. Skipping admin creation.")

        await db.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())