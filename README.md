# Care-Crew: AI-driven Medi-Kiosk

> An AI-powered healthcare platform that collects a patient's medical history through conversation, digitalizes previous medical reports, and generates a structured pre-consultation report for the doctor.

---

## Project Information

| Field                    | Details                         |
| ------------------------ | ------------------------------- |
| **Project Title**        | Care-Crew: AI-driven Medi-Kiosk |
| **Problem Statement ID** | SIH26047                        |
| **Problem Statement**    | Patient Case-Taking Software    |
| **Category**             | Software                        |
| **Theme**                | MedTech / BioTech / HealthTech  |

---

## Problem Statement

Indian hospitals, especially government and AYUSH hospitals, handle thousands of patients every day, leaving doctors with very little time to take a complete medical history.

Patients also bring medical records such as prescriptions, lab reports, and discharge summaries in different formats, making them difficult and time-consuming for doctors to review.

There is a need for a system that can collect patient information before the consultation, organize medical records, and provide doctors with a clear clinical summary.

---

## Proposed Solution

**Care-Crew** is an AI-powered, web-based clinical intake platform designed to help hospitals collect and organize patient information before a doctor's consultation.

Patients can:

* Provide their medical history through voice or touchscreen
* Interact with the system in multiple languages
* Upload previous prescriptions and medical reports
* Have their documents processed using AI-powered OCR
* Review their medical history and information

The backend processes this information using AI to structure the patient's clinical history, digitize relevant medical records, and generate a concise, doctor-ready clinical case summary.

Doctors can then review, verify, edit, and approve the generated case sheet before the consultation.

---

## Key Features

### Patient Features

* User Login
* AI Voice History Taking
* Touch-Based Interaction
* Multilingual Support
* Adaptive Questioning
* Report & Prescription Upload
* Consent & Privacy Management

### AI & Medical Intelligence

* AI-Powered Clinical History Taking
* AI-Powered OCR
* Medical Document Digitization
* Structured Clinical Summary
* Medical History Timeline
* Red-Alert / SOS Detection
* Current & Previous Diagnosis
* AYUSH History Mode
* AI-Suggested Meal Plans

### Doctor Features

* Doctor Dashboard
* Doctor Verification & Editing
* Case Sheet Approval / Rejection
* Current & Previous Diagnosis
* Appointment Management
* Dietary Plan Creation & Scheduling

### Appointment Management

* Appointment Requests
* Appointment Approval
* Appointment Rejection
* Appointment Rescheduling
* Appointment Notifications
* Appointment Scheduling

### Healthcare Integration

* Hospital System Integration
* ABHA Integration
* Structured Digital Case Sheets
* Patient Medical History Records

---

## How Care-Crew Works

```text
                    PATIENT
                       |
                       v
            +----------------------+
            |  Care-Crew Interface |
            |  Voice / Touch Input |
            +----------------------+
                       |
                       v
            +----------------------+
            |    Backend API       |
            |       FastAPI        |
            +----------------------+
                       |
          +------------+------------+------------+
          |            |            |            |
          v            v            v            v
       Database       AI           OCR         ABDM
          |            |
          |            v
          |     Clinical History
          |        Extraction
          |            |
          +------------+
                       |
                       v
            +----------------------+
            | Structured Case Sheet|
            +----------------------+
                       |
                       v
            +----------------------+
            |   Doctor Dashboard   |
            +----------------------+
                  /           \
                 v             v
          Appointments    Dietary Plans
                 |
                 v
            Notifications
```

---

## Adaptive AI History Taking

Care-Crew uses **adaptive questioning** instead of asking every patient the same set of questions.

The next question can depend on the patient's previous response, allowing the system to collect more relevant information while reducing unnecessary questions.

### Example

```text
Patient:
"I have been having stomach pain."

        ↓

AI:
"Where exactly is the pain?"

        ↓

Patient:
"On the lower right side."

        ↓

AI:
"How long have you been experiencing the pain?"
```

This makes the history-taking process more natural and personalized.

---

## Red-Alert Detection

Care-Crew analyzes patient responses for potentially serious symptoms.

If a red-flag symptom is detected, the system highlights the information for the doctor so that it can be reviewed during the consultation.

```text
Patient Input
      ↓
AI Analysis
      ↓
Red-Flag Detection
      ↓
🚨 Alert Doctor
      ↓
Doctor Review
```

> **Note:** Care-Crew is designed to assist healthcare professionals and does not replace professional medical diagnosis.

---

## AYUSH History Mode

Care-Crew supports **AYUSH-oriented patient history collection** for use in AYUSH healthcare settings.

The system can collect information related to:

* Lifestyle
* Diet
* Daily routine
* Previous treatments
* Traditional medicine history
* Relevant symptoms and health practices

This helps adapt the case-taking process to the requirements of AYUSH hospitals.

---

## Medical Document Digitization

Patients can upload medical documents such as:

* Prescriptions
* Lab reports
* Previous diagnosis reports
* Discharge summaries
* Other medical records

The system uses **AI-powered OCR and information extraction** to convert unstructured medical documents into structured digital information.

```text
Medical Document
       ↓
AI-Powered OCR
       ↓
Text Extraction
       ↓
Information Extraction
       ↓
Structured Medical Data
       ↓
Medical History Timeline
```

---

## Doctor Dashboard

The doctor receives a structured overview of the patient's information before the consultation.

The doctor can:

* View the generated case sheet
* Review patient history
* View uploaded medical records
* Check red-alert symptoms
* View previous diagnoses
* Edit extracted information
* Approve or reject the case sheet
* Manage appointments
* Create and schedule dietary plans

This reduces the amount of time doctors spend on manual history-taking and allows them to focus more on the patient.

---

## System Architecture

```text
+------------------+
|   Patient/User   |
+--------+---------+
         |
         v
+------------------+
| Frontend / Kiosk |
+--------+---------+
         |
         v
+------------------+
|   Backend API    |
|     FastAPI      |
+--------+---------+
         |
    +----+----+----------------+
    |         |                |
    v         v                v
+-------+  +-------+       +---------+
|  DB   |  |  AI   |       |   OCR   |
+-------+  +-------+       +---------+
              |
              v
       +--------------+
       |  Clinical    |
       |   History    |
       +------+-------+
              |
              v
       +--------------+
       | Structured   |
       | Case Sheet   |
       +------+-------+
              |
              v
       +--------------+
       |    Doctor    |
       |   Dashboard  |
       +------+-------+
              |
        +-----+-----+
        |           |
        v           v
 Appointments   Dietary Plans
        |
        v
 Notifications
```

---

## Technology Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Python
* FastAPI
* WebSocket
* ReportLab

### Artificial Intelligence / Machine Learning

* Google Gemini
* Groq / Llama
* Sarvam / Bhashini

### Database & Infrastructure

* PostgreSQL
* Redis

### Deployment

* Render
* Vercel

---

## Repository Structure

```text
cure-crew-sih2026/
│
├── backend/                    # FastAPI app — API + infrastructure
│   ├── app/
│   │   ├── core/               # Configuration, Redis, DB connections
│   │   ├── models/             # Pydantic CaseSheet schema
│   │   ├── services/           # Session, extraction, red-flag logic
│   │   ├── api/                # Routes + WebSocket
│   │   ├── data/               # Question trees (JSON)
│   │   └── main.py
│   │
│   └── requirements.txt
│
├── ml/                         # Extraction prompts and question-tree logic
│
├── voice/                      # ASR pipeline and patient transcripts
│
├── frontend/                   # Patient chat UI and doctor dashboard
│
├── docs/                       # Schema, presentation and notes
│
└── README.md
```

---

## Data Privacy & Consent

Care-Crew is designed with patient privacy and consent in mind.

The platform includes:

* Patient consent before data collection
* Secure handling of medical information
* Controlled access to patient records
* Doctor verification before finalizing case sheets
* Structured digital storage of medical history

---

## Installation

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
```

### 2. Navigate to the Project

```bash
cd <YOUR_PROJECT_FOLDER>
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Run the Application

Start the FastAPI backend using:

```bash
uvicorn src.main:app --reload
```

The application can then be accessed through the configured frontend and backend endpoints.

---

## Expected Impact

Care-Crew aims to:

* Reduce the time doctors spend on manual history-taking
* Reduce consultation delays in overcrowded hospitals
* Organize patient medical records
* Make previous reports easier to review
* Improve the quality and completeness of patient history
* Support multilingual patient interaction
* Assist doctors with pre-consultation information
* Improve the workflow of government and AYUSH hospitals

---

## Future Scope

### 1. Payment Integration

Integration of payment functionality for:

* Medical tests
* Appointment payments

### 2. QR-Based Patient & Doctor Identification

QR codes can be used to:

* Identify patients
* Identify doctors
* Connect patients with their appointments

### 3. Automatic Date & Time Extraction

AI can automatically extract:

* Dates from medical reports
* Report timestamps
* Appointment dates and times

### 4. Advanced Hospital Integration

Future versions can integrate with existing hospital management systems to synchronize patient records and appointments.

### 5. Advanced AI Assistance

The system can be further improved with:

* More personalized questioning
* Better clinical information extraction
* Improved multilingual support
* More accurate medical document processing

---

## Project Goal

> **Care-Crew aims to bridge the gap between patients and doctors by collecting, organizing, and presenting patient information before the consultation — allowing doctors to focus more on diagnosis and patient care.**

---

## Team

### Team Care-Crew

**Smart India Hackathon 2026**

**Problem Statement:** SIH26047 — Patient Case-Taking Software

*Team Leader: Muskan Poddar*
*Frontend: Navani Smiju, Parvathi Vineed*
*Backend: Khushi Tyagi, Anurag Kumar*
*Machine Language: Anurag Kumr*

---

## Project Resources

### Final Presentation

*https://drive.google.com/file/d/1t_cx7WqYypGxSye5ldQ1-aE9nW1SndbV/view?usp=sharing*

### Demo Video

*https://drive.google.com/file/d/1vbU3av8Rz4HfNWV9kBAM2WK3eMOxOVR9/view?usp=drivesdk*

### Screenshots / Prototype

*screenshot upload*

---

## Disclaimer

Care-Crew is an AI-assisted healthcare information and clinical intake platform. It is intended to support healthcare professionals and streamline patient information collection.

It does **not replace qualified medical professionals or serve as an independent diagnostic system.**

