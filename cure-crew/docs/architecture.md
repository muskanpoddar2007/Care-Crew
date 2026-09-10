# System Architecture

## High-level flow

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
         +----------------+----------------+
         |                |                |
         v                v                v
     +-------+        +-------+        +---------+
     |  DB   |        |  AI   |        |   OCR   |
     +-------+        +-------+        +---------+
                         |
                         v
                   +--------------+
                   |  Clinical    |
                   |   History    |
                   +------+-------+
                          |
                          v
                   +--------------+
                   |  Structured  |
                   |  Case Sheet  |
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

## Components

### Patient / User

The patient or user interacts with the Care-Crew application through the frontend or kiosk interface.

### Frontend / Kiosk

Provides the user interface for collecting patient information and presenting the application's features and results.

### Backend API

The backend API, implemented using **FastAPI**, receives requests from the frontend and coordinates the application's core services and data flow.

### Database

Stores application data required by the system.

### AI

Processes the relevant input and supports the generation of the clinical history.

### OCR

Handles optical character recognition as part of the application's input-processing workflow.

### Clinical History

The system processes the collected information to generate a structured clinical history.

### Structured Case Sheet

The generated clinical information is organized into a structured case sheet for clinical use.

### Doctor Dashboard

The structured case information is made available to the doctor through the doctor dashboard.

### Appointments

The doctor dashboard connects with appointment-related functionality.

### Dietary Plans

The system also provides access to dietary-plan functionality.

### Notifications

Notifications are generated as part of the application's workflow.

## Data Flow

1. The **Patient/User** interacts with the **Frontend / Kiosk**.
2. The frontend sends requests to the **Backend API (FastAPI)**.
3. The backend communicates with the **Database**, **AI**, and **OCR** components.
4. The AI component contributes to the generation of the **Clinical History**.
5. The clinical history is organized into a **Structured Case Sheet**.
6. The structured case sheet is presented through the **Doctor Dashboard**.
7. The doctor dashboard supports **Appointments** and **Dietary Plans**.
8. The workflow leads to **Notifications**.

## Architecture Overview

The Care-Crew architecture follows a layered flow from patient interaction through the frontend and FastAPI backend to database, AI, and OCR services. The processed clinical information is transformed into a structured case sheet and delivered to the doctor dashboard, which connects to appointment, dietary-plan, and notification functionality.
