# Attendance Management System

A small MERN project for recording employee attendance and reviewing overtime.

## Features

- Employee signup and login with password hashing.
- Employee, Manager and Admin roles with protected API routes.
- Camera selfie and browser location at punch in and punch out.
- Working hours are calculated by the server. Eight hours or more is Completed; fewer than eight hours is Incomplete.
- Employees can request overtime after punching out.
- Managers review requests and attendance for employees assigned to their team. Admins can review all records.
- Managers and Admins can open attendance selfies, view map links, mark a photo Valid or Invalid, and save a note.
- Admins can add users and assign employees to managers.
- Daily attendance table with punch times, photos, locations, working hours and status.

## Requirements

- Node.js 20 or newer
- MongoDB running locally or a MongoDB Atlas database
- A modern browser with camera and location permission

## Run the project

1. Install the frontend and backend packages:

   ```sh
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Create the backend environment file:

   ```sh
   cp .env.example .env
   ```

   Set `MONGO_URI` to your MongoDB connection string and change `JWT_SECRET` to a long random value. The default local database is `attendance_management`.

3. Create the first Admin account:

   ```sh
   npm run seed
   ```

The seed command creates three local demo accounts if they do not already exist:

| Role | Email | Password |
|---|---|---|
| Employee | `employee@example.com` | `DemoPass123!` |
| Manager | `manager@example.com` | `DemoPass123!` |
| Admin | `admin@example.com` | `DemoPass123!` |

The demo Employee is assigned to the demo Manager. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before seeding if you want a different Admin login. Set `DEMO_PASSWORD` to change the Employee and Manager demo password. The seed command does not replace existing accounts.

4. Start the backend in one terminal from the `backend` folder:

   ```sh
   npm run dev
   ```

5. Start the frontend in a second terminal from the `frontend` folder:

   ```sh
   npm run dev
   ```

6. Open the local address printed by Vite, usually [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:5001](http://localhost:5001).

The app requests location first, then opens the camera. Both permissions are required. It tries device location first; if macOS cannot determine it, the app uses IPWho to get an approximate location from the internet connection. This sends the public IP to IPWho, and the result can be less accurate than GPS. If Chrome has blocked location, click the site information icon to the left of `localhost:5173`, open **Site settings**, set **Location** to **Allow**, and reload. Also check macOS **System Settings → Privacy & Security → Location Services**. If you change the API address, create `frontend/.env` with `VITE_API_URL=http://localhost:5001/api` and restart Vite.

## First use

Sign in using one of the demo accounts shown on the login page. The Employee can punch in and out, then submit an overtime request. The Manager can review the assigned demo Employee's records. The Admin can see all records and add more users.

Employees can also create their own accounts from the sign-in screen. Only an Admin can create Manager and Admin accounts from the People section. An Admin can assign a Manager when adding an employee; manager dashboards only show assigned team members. The role on the signed-in account selects the dashboard: Employees get their punch-in/punch-out and attendance view, Managers get their assigned team and overtime reviews, and Admins get all attendance and account management.

## Project structure

```text
attendance-management/
  backend/       Express API, MongoDB models, auth and attendance routes
  frontend/      React app and RTK Query API calls
  README.md
```

Redux Toolkit Query handles API requests and refreshes attendance, overtime and user lists after changes. Express uses Morgan for request logs. MongoDB stores the account and attendance records; selfie images are stored as camera data URLs for this small assessment app.

## Simple project limits

- Camera and geolocation need a secure browser context such as `localhost` or HTTPS.
- The app does not include optional geofencing, alerts, realtime updates, or PDF/Excel export.
- This is an assessment project and uses MongoDB for selfie data; a production app should store photos in protected file or object storage.
