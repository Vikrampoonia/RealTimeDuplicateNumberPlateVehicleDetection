# 🚓 Vehicle Verification & Suspicious Detection System

This project aims to **automate and enhance vehicle verification** using deep learning and modern backend architecture. The traditional manual process of verifying a vehicle’s authenticity by comparing the number plate, chassis number, and RC is not only time-consuming but also flawed — especially when it comes to reading chassis numbers physically.

Our solution leverages computer vision and intelligent checks to **automatically verify a vehicle’s legitimacy** and **flag suspicious activity in real-time**.

---

## 🧩 Problem Statement

Manual verification of vehicle authenticity is a tedious and error-prone process. Specifically:

- Chassis number is hard to locate and verify manually.
- Real-time tracking or verification is not feasible for every vehicle.
- Malpractice such as number plate duplication or restricted zone entry can go unnoticed.

**This software aims to solve these problems by automating vehicle verification using AI-powered models and smart backend services.**

---

## 🚀 Features

### ✅ Core Features
- 🔍 **Automatic Number Plate Detection**  
- 🚗 **Vehicle Category Classification (e.g., Car, Truck, Bike)**  
- 🔔 **Real-time Suspicious Activity Detection**:
  1. Mismatched vehicle category.
  2. Implausible travel time between detection locations.
  3. Vehicle image similarity comparison to detect duplicates or fakes.



## **Modules & Workflow**

### 1️⃣ Processing Service
**Purpose:** Extract vehicle data (image, number plate, category)  

**Workflow:**  
- Detects vehicle and category using **YOLO trained model**  
- Detects the **number plate image** using a custom-trained model  
- Extracts the number using **OCR** and uploads the image to **MinIO S3 bucket**  
- Publishes an event to **Kafka** for the validation service  

---

### 2️⃣ Validation Service
**Purpose:** Validate whether a vehicle is suspicious  

**Workflow:**  
- Consumes messages from **Processing Service**  
- Retrieves previous data from the database  
- Determines if the vehicle is suspicious based on category, similarity, and location/time constraints  
- If suspicious, publishes an event to **Client API Service**  
- Stores vehicle info and history in the database  

---

### 3️⃣ Client API Service
**Purpose:** Handles client requests and delivers real-time updates  

**Workflow:**  
- Consumes Kafka messages from the **Validation Service** and sends real-time updates to clients via **WebSocket**  
- Handles HTTP requests from clients and serves vehicle data with history  

---

### 4️⃣ API Gateway
**Purpose:** Acts as a **proxy** to the client API service to prevent direct exposure  

---

### 5️⃣ Frontend
**Purpose:** Visualize vehicle alerts and history  

**Features:**  
- Displays a **list of suspicious vehicles** with 10-day history  
- Supports **pagination, filtering, and search functionality**  
- Provides an intuitive, user-friendly interface using **ReactJS + TailwindCSS**  

---

### 6️⃣ Docker-Compose
**Purpose:** Local setup for **Kafka, Redis, and MinIO S3**  
- Simplifies microservices orchestration for local development  

---

### 7️⃣ Performance Test
**Purpose:** Test the performance of all services (excluding frontend)  
- Uses **k6** for load and stress testing  

---

### 8️⃣ Result File
- `result.txt` contains performance test results for review  

---

## **Tech Stack**

| Component | Technology |
|-----------|------------|
| Storage | MongoDB, Redis, MinIO S3 |
| Message Broker | Kafka |
| Backend | NodeJS (Express), Python (Flask) |
| Frontend | ReactJS, TailwindCSS |
| Containerization | Docker, Docker-Compose |
| Testing | k6 |

---

## **Deployment & Access**

- **Frontend:** [Deployed Frontend Link]  
- **Backend:** Microservices deployed locally or on cloud servers  
- **Performance Results:** Check `result.txt` for detailed metrics  

---

## **Project Highlights**
- Fully **microservice-based architecture**  
- Real-time detection and alerting using **Kafka and WebSockets**  
- Image storage and retrieval via **MinIO S3**  
- Robust and scalable backend with **Redis caching** and optimized MongoDB queries  
- Interactive, filterable, searchable frontend UI  

---

## **Conclusion**
This project demonstrates advanced **full-stack development**, **real-time microservices architecture**, and **AI-based image detection**
