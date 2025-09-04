import os
import cv2
import re
#import json
import base64
import numpy as np
import requests
from ultralytics import YOLO
from paddleocr import PaddleOCR
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
# All constants are grouped at the top for easy modification.
SERVER_URL = os.getenv("SERVER_URL")
VEHICLE_MODEL_PATH = './weights/yolov8n.pt'
PLATE_MODEL_PATH = './weights/best.pt'
INPUT_VIDEO_PATH = './testVideo3.mov'





class VehicleProcessor:
    """
    A class to handle vehicle and license plate detection, tracking, and OCR.
    Encapsulates all model loading and processing logic.
    """
    def __init__(self, use_gpu=False):
        """
        Initializes the models and OCR engine once.
        """
        print("Loading models...")
        self.vehicle_model = YOLO(VEHICLE_MODEL_PATH)
        self.plate_model = YOLO(PLATE_MODEL_PATH)
        # It's crucial to enable GPU if available for a massive performance boost.
        self.ocr = PaddleOCR(use_angle_cls=True, use_gpu=use_gpu)
        self.detected_track_ids = set()
        print("Models loaded successfully.")

    def _encode_image(self, image):
        """Encodes a CV2 image to a base64 string."""
        _, buffer = cv2.imencode('.jpg', image)
        return base64.b64encode(buffer).decode('utf-8')

    def _perform_ocr(self, frame, box):
        """Crops the frame and performs OCR on the given box."""
        x1, y1, x2, y2 = map(int, box)
        cropped_frame = frame[y1:y2, x1:x2]
        result = self.ocr.ocr(cropped_frame, det=False, rec=True, cls=False)
        
        text = ""
        if result and result[0]:
            # Get the first result's text and confidence
            line = result[0][0]
            raw_text, confidence = line
            if confidence > 0.6: # Confidence threshold
                # Clean the text
                pattern = re.compile('[\W]')
                text = pattern.sub('', raw_text).replace("O", "0")
                
                # Validate against Indian license plate format
                regex = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$', re.IGNORECASE)
                if not regex.match(text):
                    text = "" # Discard if it doesn't match the format
        return text

    def process_frame(self, frame):
        """
        Processes a single frame to detect and track vehicles and plates.
        Returns a list of data for newly detected vehicles.
        """
        newly_detected_vehicles = []
        
        # Run vehicle tracking and plate detection
        vehicle_results = self.vehicle_model.track(frame, persist=True, verbose=False)
        plate_results = self.plate_model.predict(frame, conf=0.4, verbose=False)

        # Ensure we have tracking results
        if vehicle_results[0].boxes.id is None:
            return []
            
        boxes = vehicle_results[0].boxes.xyxy.cpu()
        track_ids = vehicle_results[0].boxes.id.int().cpu().tolist()
        class_indices = vehicle_results[0].boxes.cls.int().cpu().tolist()

        # Iterate over each detected vehicle
        for box, track_id, class_idx in zip(boxes, track_ids, class_indices):
            vx1, vy1, vx2, vy2 = map(int, box)
            
            # Check if this vehicle has already been processed
            if track_id in self.detected_track_ids:
                continue

            vehicle_class = self.vehicle_model.names[class_idx]

            # Find a license plate within this vehicle's bounding box
            for plate_result in plate_results:
                for plate_box in plate_result.boxes:
                    px1, py1, px2, py2 = map(int, plate_box.xyxy[0])
                    
                    # Check for containment: plate center must be inside vehicle box
                    plate_center_x = (px1 + px2) / 2
                    plate_center_y = (py1 + py2) / 2
                    
                    if vx1 < plate_center_x < vx2 and vy1 < plate_center_y < vy2:
                        label = self._perform_ocr(frame, (px1, py1, px2, py2))
                        
                        if label and len(label) > 4:
                            cropped_vehicle = frame[vy1:vy2, vx1:vx2]
                            
                            # Add to our list of newly detected vehicles for this frame
                            vehicle_data = {
                                "track_id": track_id,
                                "license_plate": label,
                                "vehicle_class": vehicle_class,
                                "vehicle_image_base64": self._encode_image(cropped_vehicle)
                            }
                            newly_detected_vehicles.append(vehicle_data)
                            self.detected_track_ids.add(track_id)
                            break # Assume one plate per vehicle
                if track_id in self.detected_track_ids:
                    break # Move to the next vehicle once plate is found

        return newly_detected_vehicles

def main():
    """
    Main function to run the video processing loop.
    """
    processor = VehicleProcessor(use_gpu=False) # CHANGE to True if you have a GPU
    cap = cv2.VideoCapture(INPUT_VIDEO_PATH)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file {INPUT_VIDEO_PATH}")
        return

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Process the current frame
        detected_data = processor.process_frame(frame)
        
        # If new vehicles were detected, send their data to the server
        if detected_data:
            try:
                # NOTE: This is still a bottleneck. We will optimize this next.
                requests.post(SERVER_URL, json=detected_data, timeout=2)
                print(f"Sent data for {len(detected_data)} new vehicles.")
            except requests.exceptions.RequestException as e:
                print(f"Error sending data to server: {e}")

        # Displaying the output frame
        cv2.imshow("Processing", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()


# Main function entry point
if __name__ == "__main__":
    main()
