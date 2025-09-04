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

### 🛠️ Technical Features
- 🧱 **Microservices Architecture** with SOLID principles  
- 🐳 Dockerized and **Deployed on Kubernetes**  
- ⚡ **Kafka for Efficient Message Queuing**, reducing API latency  
- 💾 Uses **MongoDB** for flexible and scalable storage  
- 🔐 JWT Authentication & **WebSocket Integration** for real-time alerts to clients  

---

## 🖥️ Tech Stack

| Layer | Technology |
|------|------------|
| Backend | Python, Flask, Node.js |
| Frontend | React.js |
| Database | MongoDB |
| DevOps | Docker, Kubernetes |
| Messaging | Kafka |
| Authentication | JWT |
| Real-time | WebSocket |

---

## 🧠 Use Cases

By slightly modifying the logic or retraining the models, this project can be used in:

1. 🔁 **Duplicate Vehicle Detection**  
2. 🏢 **Auto Logging Vehicles Entering/Leaving Buildings**  
3. 🚫 **Restricting Vehicle Entry in Sensitive Zones**  
4. 🧭 **Smart City Surveillance Systems**  
5. 🛣️ **Automated Toll Gate Monitoring**

---

## 📈 Future Enhancements

> Planned improvements to make the system even more powerful and robust:

- 🔧 **Chassis Number Detection using AI** (OCR on engine/chassis area)
- 🌐 **Location-aware Alerts with Google Maps API Integration**
- 🧠 **Train better models using larger Indian vehicle datasets**
- 📷 **Multi-angle image capture (front and back) with track ID mapping**
- 💾 **Dual storage (MongoDB + S3) for images and logs**
- 📊 **Admin Dashboard to monitor flagged vehicles with historical data**

---

## 📸 Sample Output

Here’s what the system does in real-time:
- Extracts number plate
- Detects vehicle type (e.g., SUV, Bike)
- Matches current vehicle image with the historical image
- Flags vehicle if:
  - It traveled an impossible distance in a short time
  - It doesn’t match its expected type
  - It looks similar to a previously flagged vehicle

---

## 📦 Setup Instructions

```bash
# Clone the repo
git clone https://github.com/your-username/vehicle-verification-system.git
cd vehicle-verification-system

# Start services
docker-compose up --build
