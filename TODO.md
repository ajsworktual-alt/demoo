# TODO

## User Goal
push to git

## Intent
git

## Project Summary
Project: demo

The 'demo' project serves as a monorepo containing standalone utility scripts, a browser-based 'bug_game', and a fullstack 'ml_training' application. The primary fullstack application utilizes a Python backend (likely FastAPI given the structure) for serving ML insights and a TypeScript React/Vite frontend for the dashboard. The repository appears to be a learning or playground environment.

Key files:
- ml_training/backend/app/main.py: Serves as the entry point for the backend application, initializing the API server and registering routers. Imports: fastapi.FastAPI, app.api.routes. Functions: create_app.
- ml_training/backend/app/api/routes/dashboard.py: Defines the API endpoints for dashboard-related data, acting as a controller that interfaces with backend services. Imports: fastapi.APIRouter, app.schemas, app.services. Functions: get_dashboard_metrics.
- ml_training/frontend/src/main.tsx: The entry point for the React application, responsible for mounting the root App component to the DOM. Imports: react, react-dom/client, ./App.tsx. Functions: createRoot, render.
- ml_training/frontend/src/services/api.ts: Acts as the frontend HTTP client, providing functions to make API calls to the backend and handle responses. Imports: axios. Functions: fetchInsights, fetchRecords.

## Execution Plan
- [x] Analyze the relevant files and folders related to the user goal.
- [ ] Use the current project summary and file structure to narrow the target modules.
- [ ] Scan the repository for secrets before staging or pushing changes.
- [ ] Prepare gitignore, branch, commit, and push steps in the correct order.
- [ ] Block the push if sensitive data is detected and report the blocker in chat.
