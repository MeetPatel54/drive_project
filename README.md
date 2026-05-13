# Student Result Management Platform

A full-stack platform for managing student exam results with Google Drive storage, JWT auth, and role-based dashboards.

---

## Project Structure

```
student-result-platform/
├── backend/          ← Node.js + Express + MongoDB
└── frontend/         ← React + Tailwind CSS
```

---

## Quick Start

### 1. Backend setup

```bash
cd backend
cp .env.example .env    # fill in all values
npm install
npm run seed            # creates default teacher account
npm run dev             # starts on http://localhost:5000
```

**Default teacher account** (created by seed):
- Email: `teacher@school.com`
- Password: `teacher123`

### 2. Frontend setup

```bash
cd frontend
npm install
npm run dev             # starts on http://localhost:5173
```

---

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry e.g. `7d` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/auth/callback` |
| `GOOGLE_REFRESH_TOKEN` | Get via `/auth` route on first run |
| `GOOGLE_DRIVE_FOLDER_ID` | Your Drive folder ID |
| `CLIENT_URL` | Frontend URL for CORS |

---

## API Reference

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Student registration |
| POST | `/api/auth/login` | Public | Login (all roles) |
| GET | `/api/auth/me` | Protected | Get current user |

### Results
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/results/upload` | Student | Upload result file |
| GET | `/api/results/my` | Student | View own results |
| GET | `/api/results/all` | Teacher | View all results + filters |
| GET | `/api/results/stats` | Teacher | Dashboard statistics |
| PATCH | `/api/results/:id/status` | Teacher | Approve / Reject |
| GET | `/api/results/top` | Public | Top 3 students by % |
| GET | `/api/results/:id/stream` | Protected | Stream result file |
| DELETE | `/api/results/:id` | Student/Teacher | Delete result |

---

## Roles

**Student** — can register, upload results, view own results and status, delete own pending results.

**Teacher** — login only (created via seed or manually in DB), view all results, filter by status/percentage/village, approve or reject with optional reason, view analytics.

---

## Google Drive Storage

- Files are uploaded to hourly subfolders: `2024-01-15 14:00`
- Files are **private** — served through `/api/results/:id/stream` proxy
- No public Drive URLs used — auth is always server-side
