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
