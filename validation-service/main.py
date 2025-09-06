import os
import json
import cv2
import numpy as np
import redis
from datetime import datetime
import random
import math
import boto3
from kafka import KafkaConsumer, KafkaProducer
from pymongo import MongoClient, errors, ASCENDING
from skimage.metrics import structural_similarity as ssim
from dotenv import load_dotenv

# --- Configuration Loading ---
load_dotenv()

# --- Main Service Class: ValidationProcessor ---
class ValidationProcessor:
    """
    Handles the core logic for consuming vehicle detections, validating them,
    and producing alerts for suspicious vehicles. Now with Redis caching.
    """
    # Cache records for 10 seconds. This is a short TTL because we expect
   
    CACHE_EXPIRATION_SECONDS = 10 

    def __init__(self, mongo_collection, s3_client, s3_bucket, kafka_producer, redis_client):
        self.vehicle_collection = mongo_collection
        self.s3_client = s3_client
        self.s3_bucket = s3_bucket
        self.producer = kafka_producer
        self.redis = redis_client # The new Redis client instance
        self._initialize_constants()

    def _initialize_constants(self):
        # Constants for validation logic
        self.locations = [
            (28.6139, 77.2090, "New Delhi"), (19.0760, 72.8777, "Mumbai")
        ]
        self.vehicle_speed = {
            "car": 100, "truck": 80, "auto": 40, "bus": 70, "motorcycle": 110,
            "person": 0, "bicycle": 20, "sports car": 120
        }

    def process_message(self, message_value):
        """The main entry point for processing a single Kafka message."""
        try:
            data = json.loads(message_value.decode('utf-8'))
            license_plate = data.get("license_plate")
            
            if not license_plate:
                print("⚠️ Event discarded: Missing license_plate.")
                return

            print(f"Processing event for plate: {license_plate}")

            # --- REDIS CACHING LOGIC ---
            cache_key = f"sighting:{license_plate}"
            
            # 1. CHECK THE CACHE FIRST
            cached_sighting_json = self.redis.get(cache_key)
            previous_sighting = None

            if cached_sighting_json:
                print(f"CACHE HIT for plate: {license_plate}")
                previous_sighting = json.loads(cached_sighting_json)
                # Convert the timestamp string from the cache back into a datetime object
                previous_sighting['time_stamp'] = datetime.fromisoformat(previous_sighting['time_stamp'])
            else:
                print(f"CACHE MISS for plate: {license_plate}. Fetching from DB.")
                # 2. IF CACHE MISS, FETCH FROM MONGODB
                previous_sighting = self.vehicle_collection.find_one({"license_plate": license_plate})

            # The rest of the logic proceeds with either the cached or the fresh data
            self.handle_sighting(data, previous_sighting)

            # 3. ALWAYS UPDATE THE CACHE with the CURRENT sighting's data after processing.
            # This keeps the cache fresh for the next detection.
            current_sighting_for_cache = {
                "license_plate": data["license_plate"],
                "vehicle_class": data["vehicle_class"],
                "imageUrl": data["imageUrl"],
                "time_stamp": datetime.now().isoformat() # Store as ISO string in cache
            }
            self.redis.set(cache_key, json.dumps(current_sighting_for_cache), ex=self.CACHE_EXPIRATION_SECONDS)

        except Exception as e:
            print(f"❌ An unexpected error occurred in process_message: {e}")
    
    def handle_sighting(self, current_sighting, previous_sighting):
        """Processes a new vehicle sighting against a previous one (if it exists)."""
        license_plate = current_sighting["license_plate"]

        if previous_sighting is None:
            # First time seeing this vehicle, save its current state and we're done.
            self.save_current_sighting(current_sighting)
        else:
            # We've seen this vehicle before, so we must perform validation.
            print(f"Validating against previous sighting for plate: {license_plate}")
            try:
                # Download images for comparison
                image_current = self.download_image_from_s3(current_sighting["imageUrl"])
                image_old = self.download_image_from_s3(previous_sighting["imageUrl"])

                if image_current is None or image_old is None:
                    print("❌ Validation failed: Could not download one or both images.")
                    self.save_current_sighting(current_sighting) # Save latest sighting anyway
                    return

                similarity = self.compare_images(image_current, image_old)
                lat1, lon1, name1 = random.choice(self.locations)
                lat2, lon2, name2 = random.choice(self.locations)
                shortest_distance = self.find_shortest_distance(lat1, lon1, lat2, lon2)
                
                status = self.validate_vehicle(
                    shortest_distance, current_sighting["vehicle_class"], similarity,
                    previous_sighting["vehicle_class"], previous_sighting["time_stamp"]
                )
                print(f"  - Validation result for {license_plate}: {status.upper()}")

                if status != "correct":
                    # If suspicious, publish an alert to the next Kafka topic
                    self.publish_suspicious_alert(current_sighting, previous_sighting, status, similarity, name1, name2)
                else:
                    # If not suspicious, just update the record in MongoDB with the latest info
                    self.save_current_sighting(current_sighting)
            
            except Exception as e:
                print(f"❌ Error during validation for plate {license_plate}: {e}")
                self.save_current_sighting(current_sighting)

    def download_image_from_s3(self, image_url):
        """Downloads an image from S3 and returns an OpenCV image object."""
        try:
            object_key = image_url.split('/')[-1]
            response = self.s3_client.get_object(Bucket=self.s3_bucket, Key=object_key)
            image_data = response['Body'].read()
            np_arr = np.frombuffer(image_data, np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"❌ S3 download error for {image_url}: {e}")
            return None

    def compare_images(self, img1, img2):
        try:
            img1_resized = cv2.resize(img1, (256, 256)); img2_resized = cv2.resize(img2, (256, 256))
            gray1 = cv2.cvtColor(img1_resized, cv2.COLOR_BGR2GRAY); gray2 = cv2.cvtColor(img2_resized, cv2.COLOR_BGR2GRAY)
            score, _ = ssim(gray1, gray2, full=True); return score
        except Exception: return 0.0

    def find_shortest_distance(self, lat1, lon1, lat2, lon2):
        R=6371.0;phi1=math.radians(lat1);phi2=math.radians(lat2);delta_phi=math.radians(lat2-lat1);delta_lambda=math.radians(lon2-lon1)
        a=math.sin(delta_phi/2.0)**2+math.cos(phi1)*math.cos(phi2)*math.sin(delta_lambda/2.0)**2;c=2*math.atan2(math.sqrt(a),math.sqrt(1-a))
        return R*c

    def validate_vehicle(self, shortest_distance, vehicle_class, similarity, vehicle_class_old, time_stamp_old):
        speed_new=self.vehicle_speed.get(vehicle_class.lower(),60);speed_old=self.vehicle_speed.get(vehicle_class_old.lower(),60)
        time_diff=(datetime.now()-time_stamp_old).total_seconds();actual_time_sec=(shortest_distance/speed_new)*3600 if speed_new>0 else 0
        status="correct"
        if speed_new!=speed_old:status="suspicious"
        elif similarity<0.3:status="confirmed_fraud"
        elif similarity<0.6:status="suspicious"
        elif actual_time_sec > 0 and time_diff < actual_time_sec*0.8:status="suspicious"
        return status

    def save_current_sighting(self, sighting_data):
        """Saves or updates a vehicle's record in MongoDB."""
        try:
            self.vehicle_collection.update_one(
                {"license_plate":sighting_data["license_plate"]},
                {"$set":{"vehicle_class":sighting_data["vehicle_class"],"imageUrl":sighting_data["imageUrl"],"time_stamp":datetime.now()}},
                upsert=True)
            print(f"  - Saved current sighting for {sighting_data['license_plate']} to DB.")
        except Exception as e:print(f"❌ DB update error for {sighting_data['license_plate']}: {e}")

    def publish_suspicious_alert(self, current, previous, status, similarity, loc1, loc2):
        """Publishes a detailed alert to the suspicious vehicles Kafka topic."""
        try:
            alert_data={"license_plate":current["license_plate"],"status":status,"similarity_score":similarity,"vehicle_class1":current["vehicle_class"],"vehicle_image1_url":current["imageUrl"],"vehicle_time1":datetime.now().isoformat(),"vehicle_location1":loc1,"vehicle_class2":previous["vehicle_class"],"vehicle_image2_url":previous["imageUrl"],"vehicle_time2":previous["time_stamp"].isoformat(),"vehicle_location2":loc2}
            self.producer.send(os.getenv("KAFKA_SUSPICIOUS_TOPIC"),value=json.dumps(alert_data).encode('utf-8'))
            print(f"  - ➡️  Published '{status}' alert for {current['license_plate']} to Kafka.")
        except Exception as e:print(f"❌ Kafka publish error for {current['license_plate']}: {e}")

# --- Main Application Execution ---
def main():
    """Initializes connections and starts the Kafka consumer loop."""
    connections = {}
    try:
        # Establish connection to all external services
        connections['consumer'] = KafkaConsumer(os.getenv("KAFKA_RAW_TOPIC"), bootstrap_servers=os.getenv("KAFKA_BROKERS").split(','), group_id=os.getenv("KAFKA_GROUP_ID"), api_version=(2, 0, 2))
        connections['producer'] = KafkaProducer(bootstrap_servers=os.getenv("KAFKA_BROKERS").split(','), api_version=(2, 0, 2))
        print("✅ Kafka connections established successfully.")
        
        connections['s3'] = boto3.client('s3', endpoint_url=os.getenv("S3_ENDPOINT_URL"), aws_access_key_id=os.getenv("S3_ACCESS_KEY"), aws_secret_access_key=os.getenv("S3_SECRET_KEY"))
        print("✅ MinIO (S3) client connected successfully.")
        
        mongo_client = MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000); mongo_client.admin.command('ping')
        db = mongo_client[os.getenv("MONGO_DB_NAME")]
        connections['mongo'] = db[os.getenv("MONGO_COLLECTION_NAME")]
        
        # --- ROBUST INDEX CREATION ---
        # Try to create the index. If it already exists, this will fail gracefully.
        try:
            connections['mongo'].create_index([("license_plate", ASCENDING)], unique=True)
            print("✅ MongoDB index created or already exists.")
        except errors.OperationFailure as e:
            # We specifically check for the "IndexAlreadyExists" error code (85) or similar conflicts (86)
            if e.code in [85, 86]:
                print("ℹ️ MongoDB index already exists. Continuing.")
            else:
                # If it's a different error, we should raise it.
                raise
        
        print("✅ MongoDB connected successfully.")
        
        connections['redis'] = redis.Redis.from_url(os.getenv("REDIS_URL"), decode_responses=True); connections['redis'].ping()
        print("✅ Redis connected successfully.")

    except Exception as e:
        print(f"❌ Connection failure during setup: {e}"); return

    # --- Initialize Processor and Start Consuming ---
    processor = ValidationProcessor(
        mongo_collection=connections['mongo'], s3_client=connections['s3'],
        s3_bucket=os.getenv("S3_BUCKET_NAME"), kafka_producer=connections['producer'],
        redis_client=connections['redis']
    )
    print("\n🚀 Validation service is running and listening for messages...")
    try:
        for message in connections['consumer']:
            processor.process_message(message.value)
    except KeyboardInterrupt: print("\n🛑 Shutting down validation service.")
    finally:
        # Gracefully close all connections
        for name, conn in connections.items():
            if hasattr(conn, 'close'): conn.close()
        if 'mongo_client' in locals(): mongo_client.close()

if __name__ == "__main__":
    main()