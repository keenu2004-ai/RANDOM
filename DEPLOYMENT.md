# Deployment Guide

This project utilizes a decoupled architecture targeting Vercel (Frontend), Railway (Backend), and Neon (PostgreSQL).

## 1. Database Setup (Neon)
1. Create a Neon project at https://neon.tech.
2. Obtain the `DATABASE_URL` for your connection pooler (append `?sslmode=require` if required).
3. The database URL should look like: `postgresql://role_name:password@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require`

## 2. Backend Setup (Railway)
1. Link your GitHub repository to Railway.
2. Railway will automatically detect `railway.json`.
3. Configure the following environment variables in Railway:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-neon-url>`
   - `JWT_SECRET=<strong-random-secret>`
   - `JWT_REFRESH_SECRET=<strong-random-secret>`
   - `CORS_ALLOWED_ORIGINS=<your-vercel-domain>`

## 3. Frontend Setup (Vercel)
1. Link your GitHub repository to Vercel.
2. Vercel will automatically detect the Vite React app.
3. Configure the following environment variable in Vercel:
   - `VITE_API_URL=https://<your-railway-app-domain>/api/v1`

## 4. Migrations & Seeding
Once the backend is deployed on Railway and the database is accessible:
1. Run the database migrations locally or via a Railway one-off task:
   ```bash
   DATABASE_URL=<your-neon-url> npm run db:migrate
   ```
2. Run the database seed to populate initial data:
   ```bash
   DATABASE_URL=<your-neon-url> npm run db:seed
   ```

## Local Development
Create a `.env` file based on `.env.example`.
Run `npm run dev` to start both the Vite dev server and the backend locally.
