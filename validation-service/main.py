import os
import cv2
import base64
import numpy as np
from skimage.metrics import structural_similarity as ssim
from pymongo import MongoClient
from datetime import datetime
import random
import math
import json
from kafka import KafkaConsumer, KafkaProducer
from dotenv import load_dotenv
import boto3
from botocore.client import Config
import io

# --- SETUP ---
load_dotenv()

# --- Kafka Connections ---
try:
    # This service is BOTH a consumer and a producer
    consumer = KafkaConsumer(
        os.getenv("KAFKA_RAW_DETECTIONS_TOPIC"),
        bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS"),
        group_id=os.getenv("KAFKA_CONSUMER_GROUP_ID"),
        auto_offset_reset='earliest', # Start reading at the beginning of the topic
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        # --- FIX: Explicitly set the API version ---
        api_version=(2, 0, 2) 
    )
    producer = KafkaProducer(
        bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS"),
        value_serializer=lambda x: json.dumps(x).encode('utf-8'),
        # --- FIX: Explicitly set the API version ---
        api_version=(2, 0, 2)
    )
    print("✅ Kafka connections established successfully.")
except Exception as e:
    print(f"❌ Kafka connection failed: {e}")
    consumer = None
    producer = None

# --- MinIO (S3) Client Connection ---
try:
    s3_client = boto3.client(
        's3',
        endpoint_url=f'http://{os.getenv("MINIO_ENDPOINT")}',
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
        config=Config(signature_version='s3v4')
    )
    print("✅ MinIO (S3) client connected successfully.")
except Exception as e:
    print(f"❌ MinIO (S3) client connection failed: {e}")
    s3_client = None

# --- MongoDB Connection ---
try:
    mongo_client = MongoClient(os.getenv("MONGO_URI"))
    db = mongo_client[os.getenv("MONGO_DB_NAME")]
    vehicle_collection = db[os.getenv("MONGO_COLLECTION_NAME")]
    # Create an index on license_plate for fast lookups (critical optimization)
    vehicle_collection.create_index("license_plate")
    print("✅ MongoDB connected successfully.")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    mongo_client = None


class ValidationProcessor:
    def __init__(self):
        # Mock data, same as your original code
        self.locations = [(28.6139, 77.2090, "New Delhi"), (19.0760, 72.8777, "Mumbai")]
        self.vehicle_speed = {"car": 100, "truck": 80, "auto": 40, "bus": 70, "motorcycle": 110}

    # --- NEW: S3 Image Downloader ---
    def download_image_from_s3(self, image_url):
        """Downloads an image from an S3 URL and returns it as an OpenCV image."""
        if not s3_client: return None
        try:
            bucket_name = os.getenv("MINIO_BUCKET_NAME")
            # The object key is the last part of the URL
            object_key = image_url.split('/')[-1]
            
            # Download the image into an in-memory buffer
            image_buffer = io.BytesIO()
            s3_client.download_fileobj(bucket_name, object_key, image_buffer)
            image_buffer.seek(0)
            
            # Decode the buffer into an OpenCV image
            np_arr = np.frombuffer(image_buffer.read(), np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"❌ S3 download failed for {image_url}: {e}")
            return None

    def compare_images(self, img1, img2):
        # (This logic remains the same)
        try:
            img1_resized = cv2.resize(img1, (256, 256))
            img2_resized = cv2.resize(img2, (256, 256))
            gray1 = cv2.cvtColor(img1_resized, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(img2_resized, cv2.COLOR_BGR2GRAY)
            similarity_score, _ = ssim(gray1, gray2, full=True)
            return similarity_score
        except Exception as e:
            print(f"❌ Error comparing images: {e}")
            return 0
    
    # (Distance and time validation logic also remains the same)
    def find_shortest_distance(self, lat1, lon1, lat2, lon2):
        R = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def validate_vehicle(self, shortest_distance, vehicle_class_new, similarity, vehicle_class_old, time_stamp_old):
        # Simplified time difference calculation for clarity
        time_difference = datetime.now() - time_stamp_old
        difference_sec = time_difference.total_seconds()
        
        # Avoid division by zero
        if vehicle_class_new not in self.vehicle_speed or self.vehicle_speed[vehicle_class_new] == 0:
            return "correct" 
            
        required_time_sec = (shortest_distance / self.vehicle_speed[vehicle_class_new]) * 3600
        
        status = "correct"
        if required_time_sec > 0 and (difference_sec / required_time_sec < 0.9 or similarity < 0.3 or vehicle_class_new != vehicle_class_old):
            status = "confirmed_fraud"
        elif similarity <= 0.5:
            status = "suspicious"

        return status

    def publish_suspicious_event(self, data):
        if not producer: return
        try:
            producer.send(os.getenv("KAFKA_SUSPICIOUS_VEHICLES_TOPIC"), value=data)
            producer.flush()
            print(f"🔥 Published suspicious event for plate: {data['license_plate']}")
        except Exception as e:
            print(f"❌ Failed to publish suspicious event: {e}")

    def process_message(self, message):
        """This is the core logic that runs for each Kafka message."""
        print(f"\n📩 Consumed event: {message}")
        
        license_plate = message.get("license_plate")
        vehicle_class_new = message.get("vehicle_class")
        image_url_new = message.get("imageUrl")

        # --- REFACTORED LOGIC ---
        # 1. Find the most recent previous sighting of this plate
        previous_sighting = vehicle_collection.find_one(
            {"license_plate": license_plate},
            sort=[("timestamp", -1)] # Get the latest one
        )

        # 2. Always save the current sighting to the history database
        current_sighting_doc = {
            "license_plate": license_plate,
            "vehicle_class": vehicle_class_new,
            "imageUrl": image_url_new,
            "timestamp": datetime.now(),
            "location": random.choice(self.locations)[2] # Mock location
        }
        vehicle_collection.insert_one(current_sighting_doc)
        print(f"💾 Saved current sighting for {license_plate} to DB.")

        # 3. If there was no previous sighting, our work is done.
        if previous_sighting is None:
            print(f"  -> First time seeing plate {license_plate}. No validation needed.")
            return

        # --- 4. If it's an existing plate, perform validation ---
        print(f"  -> Existing plate {license_plate} found. Starting validation...")
        
        # Download images from S3
        image_new = self.download_image_from_s3(image_url_new)
        image_old = self.download_image_from_s3(previous_sighting["imageUrl"])

        if image_new is None or image_old is None:
            print("  -> Validation skipped due to image download failure.")
            return

        # Compare images
        similarity = self.compare_images(image_new, image_old)
        
        # Mock locations for distance calculation
        lat1, lon1, name1 = random.choice(self.locations)
        lat2, lon2, name2 = random.choice(self.locations)
        shortest_distance = self.find_shortest_distance(lat1, lon1, lat2, lon2)
        
        # Get status
        status = self.validate_vehicle(
            shortest_distance, 
            vehicle_class_new, 
            similarity, 
            previous_sighting["vehicle_class"], 
            previous_sighting["timestamp"]
        )
        print(f"  -> Validation result: {status.upper()}")

        # 5. If suspicious, publish a new event to the suspicious topic
        if status != "correct":
            suspicious_data = {
                "license_plate": license_plate,
                "status": status,
                "similarity_score": similarity,
                "sighting1": {
                    "vehicle_class": vehicle_class_new,
                    "imageUrl": image_url_new,
                    "timestamp": datetime.now().isoformat(),
                    "location": name1,
                },
                "sighting2": {
                    "vehicle_class": previous_sighting["vehicle_class"],
                    "imageUrl": previous_sighting["imageUrl"],
                    "timestamp": previous_sighting["timestamp"].isoformat(),
                    "location": name2,
                }
            }
            self.publish_suspicious_event(suspicious_data)

# --- REFACTORED: Main consumer loop ---
if __name__ == '__main__':
    if not all([consumer, producer, s3_client, mongo_client]):
        print("Exiting due to connection failure during setup.")
    else:
        processor = ValidationProcessor()
        print("\n🚀 Validation service is running and listening for messages...")
        for message in consumer:
            processor.process_message(message.value)