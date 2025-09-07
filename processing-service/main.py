import os
import cv2
import re
import json
import uuid
import numpy as np
from ultralytics import YOLO
from paddleocr import PaddleOCR
from dotenv import load_dotenv
from kafka import KafkaProducer
import boto3
from botocore.client import Config
import io

# --- SETUP ---
# Load environment variables from .env file
load_dotenv()

# Kafka Producer Setup
try:
    producer = KafkaProducer(
        bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS"),
        value_serializer=lambda x: json.dumps(x).encode('utf-8')
    )
    print("✅ Kafka Producer connected successfully.")
except Exception as e:
    print(f"❌ Kafka producer connection failed: {e}")
    producer = None

# MinIO (S3) Client Setup
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

class VehicleProcessor:
    def __init__(self):
        print("Loading ML models...")
        self.vehicle_model = YOLO('./weights/yolov8n.pt')
        self.plate_model = YOLO('./weights/best.pt')
        self.ocr = PaddleOCR(use_angle_cls=True, use_gpu=False)
        print("✅ ML models loaded.")

    def paddle_ocr(self, frame, x1, y1, x2, y2):
        # (OCR logic remains the same as your original code)
        cropped_frame = frame[y1:y2, x1:x2]
        result = self.ocr.ocr(cropped_frame, det=False, rec=True, cls=False)
        text = ""
        for r in result:
            scores = r[0][1]
            scores = 0 if np.isnan(scores) else int(scores * 100)
            if scores > 60:
                text = r[0][0]
        pattern = re.compile('[\W]')
        text = pattern.sub('', text).replace("???", "").replace("O", "0")
        regex = re.compile(r'^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$', re.IGNORECASE)
        text = text if regex.match(text) else ''
        return str(text)

    # --- NEW METHOD: UPLOAD IMAGE TO S3 ---
    def upload_image_to_s3(self, image_np, bucket_name):
        """Encodes a NumPy image to JPEG and uploads it to an S3 bucket with verification."""
        if s3_client is None:
            return None
        
        object_name = f"{uuid.uuid4()}.jpg"

        try:
            # Encode image
            is_success, buffer = cv2.imencode('.jpg', image_np)
            if not is_success:
                raise ValueError("Could not encode image to JPG format")

            image_bytes = io.BytesIO(buffer)

            # Upload to S3
            s3_client.upload_fileobj(
                image_bytes,
                bucket_name,
                object_name,
                ExtraArgs={'ContentType': 'image/jpeg'}
            )

            # ✅ Verify upload by checking object exists
            response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=object_name)
            if "Contents" not in response:
                raise Exception(f"Upload verification failed for {object_name}")

            # Only return URL if upload was confirmed
            image_url = f"{os.getenv('MINIO_ENDPOINT')}/{bucket_name}/{object_name}"
            print(f"🖼️ Verified upload: {image_url}")
            return image_url

        except Exception as e:
            print(f"❌ S3 upload failed: {e}")
            return None


    # --- NEW METHOD: PUBLISH MESSAGE TO KAFKA ---
    def publish_to_kafka(self, topic, data):
        """Sends a message to a Kafka topic."""
        if producer is None: return
        try:
            producer.send(topic, value=data)
            producer.flush() # Ensure message is sent
            print(f"➡️  Event published to Kafka topic '{topic}'")
        except Exception as e:
            print(f"❌ Kafka publish failed: {e}")

    def process_video(self, video_path):
        cap = cv2.VideoCapture(video_path)
        detected_vehicles = {}

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            vehicle_results = self.vehicle_model.track(frame)
            plate_results = self.plate_model.predict(frame, conf=0.3)

            if vehicle_results[0].boxes.data is not None:
                boxes = vehicle_results[0].boxes.xyxy.cpu()
                track_ids = vehicle_results[0].boxes.id
                class_indices = vehicle_results[0].boxes.cls.int().cpu().tolist()
                confidences = vehicle_results[0].boxes.conf.cpu()
                
                track_ids = track_ids.int().cpu().tolist() if track_ids is not None else [-1] * len(boxes)

                for box, track_id, class_idx, confidence in zip(boxes, track_ids, class_indices, confidences):
                    if confidence > 0.5:
                        vx1, vy1, vx2, vy2 = map(int, box)
                        vehicle_class = self.vehicle_model.names[class_idx]

                        for plate_result in plate_results:
                            for plate_box in plate_result.boxes:
                                x1, y1, x2, y2 = map(int, plate_box.xyxy[0])
                                if vx1 <= x1 <= vx2 and vy1 <= y1 <= vy2:
                                    label = self.paddle_ocr(frame, x1, y1, x2, y2)
                                    
                                    if label and len(label) >= 4 and track_id not in detected_vehicles:
                                        detected_vehicles[track_id] = label
                                        
                                        # --- REFACTORED LOGIC ---
                                        # 1. Crop the vehicle image
                                        cropped_vehicle = frame[vy1:vy2, vx1:vx2]

                                        # 2. Upload the image to S3 (MinIO)
                                        image_url = self.upload_image_to_s3(cropped_vehicle, os.getenv("MINIO_BUCKET_NAME"))

                                        if not image_url:
                                            print("⚠️ Skipping Kafka publish: upload failed.")
                                            continue  # ❌ don’t push broken URLs

                                        vehicle_data = {
                                            "track_id": track_id,
                                            "license_plate": label,
                                            "vehicle_class": vehicle_class,
                                            "imageUrl": image_url
                                        }
                                        self.publish_to_kafka(os.getenv("KAFKA_RAW_DETECTIONS_TOPIC"), vehicle_data)                        
        cap.release()
        cv2.destroyAllWindows()

# --- MAIN EXECUTION ---
if __name__ == '__main__':
    if producer is None or s3_client is None:
        print("Exiting due to connection failure.")
    else:
        processor = VehicleProcessor()
        # Replace with your test video file path
        processor.process_video('./testVideo3.mov')
