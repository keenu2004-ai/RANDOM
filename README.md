<div align="center">
  <h1>THEIAKSHI ENTERPRISE HRMS</h1>
  <p>Production-ready modern Human Resource Management System</p>
</div>

## Architecture

This application employs a modern distributed deployment architecture:

- **Frontend**: Hosted on [Vercel](https://vercel.com) (React + Vite)
- **Backend**: Hosted on [Railway](https://railway.app) (Express API Server)
- **Database**: Hosted on [Neon](https://neon.tech) (PostgreSQL)

```
                    ┌───────────────┐
                    │    GitHub     │
                    │ Source Code   │
                    └───────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
        ┌────────────────┐    ┌────────────────┐
        │    VERCEL      │    │    RAILWAY     │
        │ React/Vite     │───►│ Express API    │
        │ Frontend       │HTTPS│ Backend        │
        └────────────────┘    └───────┬────────┘
                                      │
                                      │ DATABASE_URL
                                      ▼
                              ┌────────────────┐
                              │      NEON      │
                              │ PostgreSQL     │
                              │ Production DB  │
                              └────────────────┘
```

## Features
- Strict Role-Based Access Control (RBAC)
- Multi-Tenant Organizational Data Isolation
- Attendance Tracking (GPS + Geofencing ready)
- Leave & Payroll Management
- Helpdesk & Document Vault

## Deployment
Please see [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions on setting up Vercel, Railway, and Neon.

## Local Development
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in local details (can use local PGlite for rapid dev).
4. Run `npm run dev` to start both frontend and backend concurrently.
