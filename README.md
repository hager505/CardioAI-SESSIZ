<img width="1024" height="1024" alt="WhatsApp Image 2025-11-19 at 01 52 15_686934d9" src="https://github.com/user-attachments/assets/752ba149-0054-40fe-8cf3-fda3e355982a" />


Integrated AI Cardiac Monitoring System
  / My Projects
Description
01. Executive Summary
Cardiovascular diseases remain the leading cause of mortality worldwide and represent a critical healthcare challenge in Egypt and the region. While significant advancements have been made in cardiac surgeries and interventional procedures, post-operative follow-up remains fragmented, reactive, and heavily dependent on periodic hospital visits and patient self-reporting.

A large percentage of serious post-operative cardiac complications occur after hospital discharge, when patients are no longer under continuous medical supervision. Delayed detection of warning signs often leads to emergency readmissions, higher healthcare costs, and preventable patient suffering.

Cardio AI introduces a new approach to post-operative cardiac care: a continuous, AI-powered monitoring platform that combines wearable hardware, personalized artificial intelligence, and dual medical portals to transform cardiac follow-up from reactive care into predictive, preventive care. By enabling real-time monitoring, early risk detection, and intelligent alerting for both patients and doctors, Cardio AI aims to reduce complications, lower readmission rates, and improve long-term outcomes for cardiac patients.

02. Problem Statement
The success of cardiac surgery does not end in the operating room. For many patients, the most dangerous phase begins after discharge, when they return home without constant medical oversight.

Current healthcare systems primarily prioritize:

In-hospital monitoring during the immediate acute phase.

Short-term post-discharge visits that only capture static snapshots of health.

Manual follow-up processes that rely heavily on patient memory and subjective self-reporting.

However, cardiac patients often experience delayed complications—such as arrhythmias, oxygen desaturation, blood pressure instability, or early signs of heart failure—days or weeks after surgery. Cardio AI addresses this critical gap by introducing a smart, continuous, and patient-specific post-operative monitoring system designed to support both patients and healthcare providers beyond hospital walls.

03. Proposed Solution & Core Functionality
Cardio AI closes the post-discharge monitoring gap through a three-layer architecture that combines medical-grade sensing, intelligent analytics, and human-governed alerting into a single unified platform:

Layer 1: Medical-Grade Sensing (Wearable Device): The platform's hardware layer combines an Arduino-based microcontroller with medical-grade sensors, including the AD8232 ECG module and DS18B20 temperature sensor, acquiring continuous cardiac electrical signals and body temperature data. The device is lightweight, wrist-worn, and designed for 24/7 operation with minimal patient burden.

Layer 2: Intelligent Analytics (AI Engine): When vital sign data streams to the cloud backend, the AI engine processes it through two complementary models:

A deep learning LSTM/GRU network trained on 21,837 ECG recordings from the PTB-XL dataset for five-class diagnostic classification (NORM, MI, STTC, CD, HYP).

A machine learning Random Forest classifier for real-time vital signs risk prediction based on seven structured features.

The system establishes a personalized baseline for each patient during a 72-hour initialization period, enabling the detection of subtle deviations from individual norms rather than generic population thresholds.

Layer 3: Human-Governed Alerting (Dashboard & Notifications): Every output the AI generates—whether a risk score update, a trend anomaly, or a critical alert—is presented to the physician through a green/yellow/red triage dashboard for review before any clinical action is taken. Approved alerts trigger multi-channel notifications including dashboard flashes, mobile push notifications, and planned WhatsApp/SMS integration for family members.

Core Platform Capabilities:
Continuous ECG and temperature monitoring via a lightweight wearable device.

Personalized AI risk assessment with patient-specific baseline establishment.

Real-time physician dashboard with prioritized triage (green/yellow/red).

Patient portal with health summaries, medication reminders, and vital trend visualization.

Automated alert generation with human-in-the-loop physician approval.

Secure cloud backend with end-to-end encryption and role-based access control.

Open-source architecture eliminating licensing barriers for developing healthcare systems.

04. Technical Approach
A. Hardware Development
The core wearable device is built on the Arduino Uno R3 microcontroller platform, selected for rapid prototyping, extensive community support, and straightforward sensor integration.

The AD8232 single-lead heart rate monitor front-end provides medical-grade ECG signal acquisition with an integrated instrumentation amplifier, right-leg drive, and lead-off detection.

The DS18B20 waterproof temperature sensor delivers accuracy via the digital 1-Wire protocol.

The prototype achieves a 250 Hz ECG sampling rate with real-time heart rate calculation through R-peak detection, transmitting packaged JSON data via serial/USB at 115200 baud.

B. AI Model Development
Deep Learning Model: Built on a bidirectional LSTM architecture with two recurrent layers (128 and 64 units), dropout regularization (0.3–0.5), and a dense classification head with a sigmoid activation function for five-class ECG diagnostic classification. Training was performed on the PTB-XL dataset comprising 21,837 12-lead ECG recordings, augmented to 50,000 samples through time-series resampling, noise injection, amplitude scaling, and synthetic pattern generation. The model achieved 82.0% accuracy and an 0.935 AUROC.

Machine Learning Model: Employs a Random Forest ensemble with 100 estimators, a max depth of 4, and balanced class weighting for binary risk prediction from seven vital sign features (heart rate, systolic BP, diastolic BP, SpO2, temperature, BMI, and respiratory rate). This model achieved 96.12% test accuracy and a 0.94+ AUROC, with feature importance analysis identifying oxygen saturation, BMI, and temperature as the most predictive parameters.

C. Cloud Platform Architecture & Integration
The backend is built on Node.js with the Express.js framework, providing RESTful API endpoints for data ingestion, patient management, and alert handling.

Real-time communication is implemented via Socket.io for live dashboard updates.

A MySQL database via XAMPP stores patient profiles, time-series vital readings, alert logs, and AI baseline parameters.

Security layers include TLS 1.3 encryption, JWT authentication, SHA-256 device hashing, and AES-256 database encryption.

System Data Flow: Sensor acquisition Arduino preprocessing JSON packaging Serial transmission Node.js API ingestion  MySQL storage  AI inferenceRisk scoring  Alert logic  Dashboard broadcast. System uptime testing demonstrated 99.7% reliability over 24-hour continuous operation with a 3.2-second alert generation latency.

05. Expected Impact & Quantified Targets
Value Proposition:
For Individual Patients: Cardio AI is projected to reduce preventable emergency visits by 30–40% through the early detection of deterioration patterns before symptomatic presentation.

For Hospitals & Cardiac Centers: The platform introduces a scalable mechanism for extending post-discharge care without proportional staff expansion. The triage dashboard enables a single cardiologist to monitor 50+ patients simultaneously.

For the Egyptian Healthcare System: In a market where cardiovascular disease accounts for over 40% of mortality yet remote monitoring adoption remains below 5% in public hospitals, Cardio AI offers an affordable alternative. The prototype cost is only 1,190 EGP (compared to 8,000–20,000 EGP for commercial smartwatches/Holter monitors), supported by a B2B subscription model (150–200 EGP/patient/month).

For the Medical AI Research Community: It represents one of the first publicly documented integrations of deep learning ECG classification with machine learning vital signs risk prediction in a unified remote monitoring platform.

Quantified Targets:
30%+ reduction in preventable cardiac emergency visits through AI-assisted early detection.

25%+ reduction in post-operative readmission rates through continuous monitoring.

85%+ physician satisfaction with alert relevance and triage prioritization.

50+ concurrent patients monitored per physician dashboard without cognitive overload.

1,000+ patients monitored within 18 months of the pilot launch.

Long-Term Vision: A world where every cardiac patient discharged from a hospital carries with them not just a prescription and a follow-up appointment, but a continuous, intelligent, personalized guardian that understands their unique heart—detecting danger before it becomes a disaster, and keeping the promise of complete care that begins in the operating room and continues without interruption at home.


