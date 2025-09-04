import os
from dotenv import load_dotenv
from pymongo import MongoClient, errors

# Load .env variables
load_dotenv()

# Environment variables
MONGO_URI = os.getenv("MONGO_URI", "").strip()
DB_NAME = os.getenv("MONGO_DB", "").strip()
VEHICLE_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_VEHICLE", "").strip()
CAMERA_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_CAMERA", "").strip()


def connect_mongo():
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("✅ MongoDB connected successfully.")

        db = client[DB_NAME]
        vehicle_collection = db[VEHICLE_COLLECTION_NAME]
        camera_collection = db[CAMERA_COLLECTION_NAME]
        return vehicle_collection, camera_collection

    except errors.ServerSelectionTimeoutError as err:
        print("❌ MongoDB connection failed:", err)
        return None, None
