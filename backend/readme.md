# 🏙️ Smart Civic Connect — Backend

A **FastAPI**-powered REST API for managing municipal complaints across citizens, field workers, municipal officers, and administrators.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Permissions](#roles--permissions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | FastAPI                             |
| ORM         | SQLAlchemy 2.0 (Async)              |
| Database    | PostgreSQL (via `asyncpg`)          |
| Auth        | JWT (PyJWT) + OAuth2 Password Flow  |
| Validation  | Pydantic v2                         |
| Password    | Passlib (bcrypt)                    |
| Server      | Uvicorn                             |

---

## 📁 Project Structure

```
backend/
├── main.py          # All API route definitions (FastAPI app)
├── models.py        # SQLAlchemy ORM models
├── schemas.py       # Pydantic request/response schemas
├── database.py      # DB engine, session, and enums
├── security.py      # JWT creation & password hashing helpers
├── seed.py          # Database seeding script
├── requirements.txt # Python dependencies
└── .env             # Environment variables (not committed)
```

---

## 👥 Roles & Permissions

| Role                  | Key Capabilities                                                                          |
|-----------------------|-------------------------------------------------------------------------------------------|
| **Citizen**           | Register, submit complaints, upload images, view own complaints, submit feedback, receive notifications |
| **Field Worker**      | View assigned tasks, update complaint status, upload images, toggle availability          |
| **Municipal Officer** | Assign field workers to complaints, recategorize complaints, update complaint status       |
| **Administrator**     | Full access — create officers/workers, manage all users, view analytics, reset passwords   |

---

## 🚀 Getting Started

### 1. Clone & Navigate

```bash
cd backend
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/<dbname>
SECRET_KEY=your_super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 5. Seed the Database (Optional)

```bash
python seed.py
```

---

## ▶️ Running the Server

```bash
uvicorn main:app --reload
```

The API will be available at: **`http://localhost:8000`**

Interactive docs: **`http://localhost:8000/docs`**

---

## 📡 API Endpoints

### 🔐 Authentication

| Method | Endpoint         | Description                    | Auth Required |
|--------|------------------|--------------------------------|---------------|
| POST   | `/auth/register` | Register a new citizen account | No            |
| POST   | `/auth/login`    | Login and receive a JWT token  | No            |

---

### 📢 Complaints

| Method | Endpoint                             | Description                                        | Roles Allowed                               |
|--------|--------------------------------------|----------------------------------------------------|---------------------------------------------|
| POST   | `/complaints/`                       | Submit a new complaint                             | Citizen                                     |
| GET    | `/complaints/`                       | List complaints (own for citizens, all for admins) | Citizen, Officer, Administrator             |
| GET    | `/complaints/{complaintId}`          | Get full details of a single complaint             | Citizen (own), Officer, Admin               |
| GET    | `/complaints/nearby`                 | Find complaints within a geographic radius         | All authenticated users                     |
| GET    | `/complaints/worker/tasks`           | List complaints assigned to the logged-in worker   | Field Worker                                |
| PATCH  | `/complaints/{complaintId}/status`   | Update complaint status (with history log)         | Officer, Admin, Field Worker (if assigned)  |
| PATCH  | `/complaints/{complaintId}/assign`   | Assign a field worker to a complaint               | Officer, Administrator                      |
| PATCH  | `/complaints/{complaintId}/category` | Recategorize a complaint                           | Officer, Administrator                      |
| POST   | `/complaints/{complaintId}/image`    | Upload an image attachment                         | Citizen (owner), Field Worker (assigned)    |
| POST   | `/complaints/{complaintId}/feedback` | Submit rating & feedback for a resolved complaint  | Citizen (owner)                             |

---

### 👷 Field Workers

| Method | Endpoint                   | Description                                       | Roles Allowed          |
|--------|----------------------------|---------------------------------------------------|------------------------|
| POST   | `/workers/`                | Register a new field worker                       | Administrator          |
| GET    | `/workers/`                | List workers (filter by `skillSet`)               | Officer, Administrator |
| PATCH  | `/workers/me/availability` | Toggle availability (`AVAILABLE`/`UNAVAILABLE`)   | Field Worker           |

---

### 🔔 Notifications

| Method | Endpoint            | Description                                  | Roles Allowed |
|--------|---------------------|----------------------------------------------|---------------|
| GET    | `/notifications/me` | Get notification inbox for logged-in citizen | Citizen       |

---

### 🛡️ Admin

| Method | Endpoint                         | Description                                           | Roles Allowed |
|--------|----------------------------------|-------------------------------------------------------|---------------|
| GET    | `/admin/analytics`               | City-wide complaint statistics (by status & severity) | Administrator |
| POST   | `/admin/users/official`          | Create a Municipal Officer account                    | Administrator |
| GET    | `/admin/users`                   | Search/list all users (filter by name, email, role)   | Administrator |
| PATCH  | `/admin/users/{user_id}`         | Update user account (suspend, edit skills/dept)       | Administrator |
| PATCH  | `/users/{userId}/reset-password` | Reset a user's password                               | Administrator |

---

## 🗄️ Data Models

### Users (Polymorphic Inheritance)

```
UserModel (base)
├── CitizenModel           → address
├── MunicipalOfficerModel  → department, designation
├── FieldWorkerModel       → skillSet, availabilityStatus
└── AdministratorModel     → accessLevel
```

### Core Entities

| Model                  | Description                                      |
|------------------------|--------------------------------------------------|
| `ComplaintModel`       | Core complaint record with status & severity     |
| `LocationModel`        | Latitude, longitude, and address of a complaint  |
| `CategoryModel`        | Category name and responsible department         |
| `StatusHistoryModel`   | Audit log of all complaint status changes        |
| `MediaAttachmentModel` | File uploads (images) linked to a complaint      |
| `FeedbackModel`        | Citizen rating (1–5) + comments after resolution |
| `NotificationModel`    | In-app notifications sent on status changes      |

### Enums

| Enum           | Values                                        |
|----------------|-----------------------------------------------|
| `StatusEnum`   | `PENDING`, `ASSIGNED`, `RESOLVED`, `REJECTED` |
| `SeverityEnum` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`           |

---

## 📝 Notes

- Uploaded images are stored in the `uploads/` directory and served statically at `/uploads/<filename>`.
- JWT tokens must be passed as a `Bearer` token in the `Authorization` header for all protected routes.
- Field worker assignment includes **skill validation** — the worker's `skillSet` must match the complaint category's `department`.
- Status changes automatically trigger **in-app notifications** to the citizen who filed the complaint.
