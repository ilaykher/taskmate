# TaskMate

TaskMate is a responsive to-do application with a React/Vite frontend and an Express API backed by Neon PostgreSQL and Prisma. Authentication uses bcrypt password hashes and JWTs in HTTP-only cookies.

## Requirements

- Node.js 18 or newer and npm
- A Neon PostgreSQL database

## Neon setup

1. Create a project and database in [Neon](https://neon.tech/).
2. In the Neon dashboard, copy the PostgreSQL connection string. Use the pooled connection string for the app and keep `sslmode=require` enabled.
3. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` to the Neon connection string, and replace `JWT_SECRET` with a long random secret. Keep the URL private; URL-encode special characters in its username or password.

The example format is:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@EP_HOST.neon.tech/taskmate?sslmode=require
```

## Install and run

Set `DATABASE_URL` in `backend/.env` first, then initialize the database and start the backend:

```sh
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

In a second terminal, install and run the frontend:

```sh
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To run both from the repository root, install the root and package dependencies with `npm install` and `npm run install:all`, then use `npm run dev`.

The backend also exposes these Prisma scripts: `npm run db:migrate` and `npm run db:generate` (run them from `backend`).

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string | required |
| `PORT` | API port | `5000` |
| `JWT_SECRET` | Signs session tokens | required |
| `JWT_EXPIRES_IN` | JWT lifetime | `7d` |
| `CLIENT_URL` | Allowed frontend origin | `http://localhost:5173` |
| `NODE_ENV` | Enables secure production cookies | `development` |

`frontend/.env` may set `VITE_API_URL`; the default is `http://localhost:5000/api`.

## Deploy to Render and Vercel

1. Push the project to GitHub.
2. In Render, create a **Web Service** for the repository:
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm start`
   - Add the backend environment variables listed below. Render supplies `PORT` to the service.
3. Apply the committed Prisma migrations to the production Neon database before using the API. Run `npx prisma migrate deploy` from the backend with the production `DATABASE_URL`.
4. In Vercel, import the same repository:
   - Root Directory: `frontend`
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Add `VITE_API_URL` as a frontend environment variable.
5. Set Render's `CLIENT_URL` to the exact deployed Vercel origin, such as `https://your-frontend-name.vercel.app` (no path or trailing slash). Set Vercel's `VITE_API_URL` to the exact Render API origin plus `/api`, such as `https://your-backend-name.onrender.com/api`.
6. Redeploy both services after changing their environment variables.

Backend production environment variables in Render:

```env
DATABASE_URL=<Neon pooled PostgreSQL connection string>
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend-name.vercel.app
NODE_ENV=production
```

Render sets `PORT` automatically; the API uses `5000` as its local fallback. Never add database credentials or JWT secrets to Vercel. The only frontend environment variable is:

```env
VITE_API_URL=https://your-backend-name.onrender.com/api
```

The production API allows only the origin in `CLIENT_URL`, enables credentialed CORS, and sets the session cookie as HTTP-only, secure, and `SameSite=None`. The Vercel rewrite keeps React Router URLs working when a page is refreshed directly.

### Deployment troubleshooting

- **CORS errors:** make sure Render's `CLIENT_URL` exactly matches the Vercel origin, including `https://`, without a trailing slash. Make sure Vercel's `VITE_API_URL` includes the Render origin and `/api`, then redeploy both.
- **401 Unauthorized:** sign in again and check that `JWT_SECRET` has not changed between deployments. Check browser cookies and confirm the API returns `Access-Control-Allow-Credentials: true` for the Vercel origin.
- **Prisma errors:** check the Render build logs for `prisma generate`; confirm the generated client matches `schema.prisma` and apply migrations with `npx prisma migrate deploy`.
- **Database connection errors:** verify Render's `DATABASE_URL` is copied from the correct Neon project, uses the pooled host and `sslmode=require`, and has URL-encoded credentials. Confirm the Neon project and endpoint are active.
- **Cookie not being sent:** production requires HTTPS, `NODE_ENV=production`, `SameSite=None`, `Secure`, Axios `withCredentials`, and CORS credentials. Check browser privacy settings if third-party cookies are blocked; using custom frontend and backend domains under the same site can avoid cross-site cookie restrictions.
- **Backend sleeping on Render's free plan:** a service that has been idle may take time to wake on its next request. Use an always-on plan if that startup delay is not acceptable.

## API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/:id`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/complete`
- `GET /api/tasks/recommended-order`
- `POST /api/tasks/estimate` with `{ "taskIds": [1, 2] }`

Task routes require the JWT cookie and only return or change tasks owned by the signed-in user. A task needs a title, due date, priority (`LOW`, `MEDIUM`, or `HIGH`), category, and positive estimated duration in minutes. Description is optional. Create, edit, completion, and deletion return a fresh `{ tasks, counters }` snapshot.

## Algorithms

1. **Online task updates:** after each task mutation, Prisma reloads the user's task list and database counts. Counters include completed, remaining, due today, overdue, and progress; pending overdue tasks are marked using their due date.
2. **Informed task prioritization:** pending tasks receive a score: HIGH +30, MEDIUM +20, LOW +10, due today +25, overdue +40, with a small duration penalty. Results sort highest score first and include `priorityScore`.
3. **Monte Carlo time estimate:** the estimate endpoint checks that every selected ID belongs to the user and is pending, then runs 1,000 simulations with ±20% random duration variation. It returns minimum, average, and maximum minutes plus readable duration strings.

Existing MongoDB records are not copied automatically. They remain in the old database; the Neon schema starts empty after its first migration.

## Project structure

```text
frontend/                 React, Vite, Router, Axios, Tailwind
backend/
  controllers/            Auth and task request handlers
  middleware/             Authentication and error handling
  prisma/                 PostgreSQL schema and migrations
  routes/                 API routes
  services/               Online snapshots and task algorithms
  utils/                  Prisma client, connection, token, async helpers
```
