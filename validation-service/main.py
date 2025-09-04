
from flask import Flask, request, jsonify
import cv2
import base64
import numpy as np
from skimage.metrics import structural_similarity as ssim
from pymongo import MongoClient, errors
from datetime import datetime
import random
import math
import json
from kafka import KafkaProducer

app = Flask(__name__)

from dataBase.connectionDB import connect_mongo

# Connect to MongoDB and get the collections
vehicle_collection, camera_collection = connect_mongo()

#connection string mongodb+srv://pooniavikram348:<vehicleDetection>@cluster0.qq8kmmn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Kafka Producer Setup with error handling
try:
    producer = KafkaProducer(
        bootstrap_servers=['localhost:9092'],
        value_serializer=lambda x: json.dumps(x).encode('utf-8'),
        acks='all',  # Wait for all replicas to acknowledge
        retries=5,   # Retry up to 5 times if sending fails
        retry_backoff_ms=500 , # Back off 500ms between retries
        max_request_size=52428800 
    )
    print(" Kafka producer connected successfully.")
except Exception as e:
    print(f" Kafka producer connection failed: {e}")
    producer = None

locations = [
    (28.6139, 77.2090, "New Delhi"),
    (19.0760, 72.8777, "Mumbai"),
    (13.0827, 80.2707, "Chennai"),
    (22.5726, 88.3639, "Kolkata"),
    (12.9716, 77.5946, "Bangalore"),
    (17.3850, 78.4867, "Hyderabad"),
    (26.9124, 75.7873, "Jaipur"),
    (23.0225, 72.5714, "Ahmedabad"),
    (18.5204, 73.8567, "Pune"),
    (15.2993, 74.1240, "Goa")
]

days = [31, 58, 89, 119, 150, 180, 211, 242, 272, 303, 333, 364]

vehicle_speed = {
    "car": 100,
    "truck": 80,
    "auto": 40,
    "bus": 70,
    "motorcycle": 110
}

# Enhanced Kafka message sending with callback for confirmation
def send_to_kafka(data, topic='vehicleTestingTopic'):
    if producer is None:
        print("⚠️ Kafka producer not available. Cannot send message.")
        return False
    
    try:
        # Send message with callback to confirm delivery
        future = producer.send(topic, value=data)
        # Optional: Wait for the message to be delivered
        record_metadata = future.get(timeout=10)
        print(f"🟢 Suspicious data sent to Kafka topic {topic}!")
        print(f"    Topic: {record_metadata.topic}")
        print(f"    Partition: {record_metadata.partition}")
        print(f"    Offset: {record_metadata.offset}")
        return True
    except Exception as e:
        print(f"❌ Failed to send message to Kafka: {e}")
        return False

# Decode base64 to OpenCV image
def decode_base64_to_image(base64_str):
    try:
        img_data = base64.b64decode(base64_str)
        np_arr = np.frombuffer(img_data, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"❌ Error decoding image: {e}")
        return None

# Compare two images using SSIM
def compare_images(img1, img2):
    try:
        img1 = cv2.resize(img1, (256, 256))
        img2 = cv2.resize(img2, (256, 256))
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        similarity_score, _ = ssim(gray1, gray2, full=True)
        return similarity_score
    except Exception as e:
        print(f"❌ Error comparing images: {e}")
        return 0

def find_shortest_distance(lat1, lon1, lat2, lon2):
    # Radius of Earth in kilometers. Use 3956 for miles
    R = 6371.0  

    # Convert decimal degrees to radians 
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine formula 
    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c  # in kilometers
    return distance

def no_of_days(year1, year2):
    count = 0
    for year in range(year1, year2 + 1):
        # Leap year check
        if (year % 400 == 0):
            count += 1  # Leap year 
        
    return (year2-year1)*365+count

# To check vehicle is suspicious or wearing duplicate or not
def validate_vehicle(shortest_distance, vehicle_class, similarity, vehicle_class1, time_stamp):
    # Find time difference between them 
    current_Date = datetime.now()
    current_year = current_Date.year
    current_month = current_Date.month
    current_day = current_Date.day
    current_hour = current_Date.hour
    current_min = current_Date.minute
    current_sec = current_Date.second
    past_year = time_stamp.year
    past_month = time_stamp.month
    past_day = time_stamp.day
    past_hour = time_stamp.hour
    past_min = time_stamp.minute
    past_sec = time_stamp.second

    total_days = 0
    total_days += no_of_days(current_year, past_year)
    if current_month >= 2:
        if current_year % 400 == 0:
            total_days += days[current_month-1] + 1
        else:
            total_days += days[current_month-1]
    else:
        total_days += days[0]

    total_days += current_day
    total_days = total_days * 24 * 60 * 60 + current_hour * 60 * 60 + current_min * 60 + current_sec  # total number of seconds

    total_days1 = 0
    if past_month >= 2:
        if past_year % 400 == 0:
            total_days1 += days[past_month-1] + 1
        else:
            total_days1 += days[past_month-1]
    else:
        total_days1 += days[0]

    total_days1 += past_day
    total_days1 = total_days1 * 24 * 60 * 60 + past_hour * 60 * 60 + past_min * 60 + past_sec  # total number of seconds

    difference_Sec = total_days - total_days1
    actual_time = shortest_distance / vehicle_speed[vehicle_class] * 60 * 60
    
    status = "correct"
    if actual_time == 0:
        return status
    elif difference_Sec / actual_time < 0.9 or similarity < 0.3 or vehicle_speed[vehicle_class] != vehicle_speed[vehicle_class1]:
        status = "confirm"
    elif similarity <= 0.5:
        status = "suspicious"

    return status

@app.route('/cameraData', methods=['POST'])
def camera_endpoint():
    print("Request received")
    data = request.get_json()
    kafka_sent_count = 0
    total_entries = len(data)
    
    for entry in data:
        print("Processing entry")
        license_plate = entry.get("license_plate")
        vehicle_class = entry.get("vehicle_class")
        front_64 = entry.get("vehicle_image_base64")
        print(f"Processing license plate: {license_plate}")
        
        # Fetch image of this license plate if previous exists
        back_64 = vehicle_collection.find_one({"license_plate": license_plate})
        
        if back_64 is None:
            # Save to db for first time
            new_doc = {
                "license_plate": license_plate,
                "vehicle_class": vehicle_class,
                "vehicle_image": front_64,
                "time_stamp": datetime.now()  
            }
            vehicle_collection.insert_one(new_doc)
            print("New vehicle record created")
        else:
            print("Existing vehicle record found - comparing images")
            # Extract previous vehicle info
            front_img = decode_base64_to_image(front_64)
            back_img = decode_base64_to_image(back_64["vehicle_image"])

            # Compare similarity
            similarity = compare_images(front_img, back_img)

            # Get random locations (in production, these would come from camera info)
            lat1, lon1, name1 = random.choice(locations)
            lat2, lon2, name2 = random.choice(locations)

            # Find shortest distance
            shortest_distance = find_shortest_distance(lat1, lon1, lat2, lon2)
            
            # Get vehicle status
            status = validate_vehicle(shortest_distance, vehicle_class, similarity, 
                                      back_64["vehicle_class"], back_64["time_stamp"])
            print(f"Vehicle status: {status}")
            
            if status != "correct":
                # Create payload for suspicious vehicle
                suspicious_data = {
                    "license_plate": license_plate,
                    "status": status,
                    "vehicle_class1": vehicle_class,
                    "vehicle_image1": front_64,
                    "vehicle_time1": datetime.now().isoformat(),
                    "vehicle_location1": name1,
                    "vehicle_class2": back_64["vehicle_class"],
                    "vehicle_image2": back_64["vehicle_image"],
                    "vehicle_time2": back_64["time_stamp"].isoformat(),
                    "vehicle_location2": name2,
                    "similarity_score": similarity
                }
                
                # Send suspicious data to Kafka
                if send_to_kafka(suspicious_data):
                    kafka_sent_count += 1
            else:
                # Update timestamp for legitimate vehicle
                vehicle_collection.update_one(
                    {"license_plate": license_plate}, 
                    {"$set": {"vehicle_image": front_64, "time_stamp": datetime.now()}}
                )
    
    return jsonify({
        "success": True, 
        "processed": total_entries,
        "suspicious_sent_to_kafka": kafka_sent_count
    }), 200

if __name__ == '__main__':
    app.run(port=4001, debug=True)



