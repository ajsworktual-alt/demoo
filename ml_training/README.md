# Ml Training

Generated from the request:

> can you help me to build a ci/cd pipeline for ml training

## Structure

- `backend/` contains the FastAPI API
- `frontend/` contains the React + Vite application

## Run backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Run frontend

```bash
cd frontend
npm install
npm run dev
```
