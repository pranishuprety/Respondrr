# Respondr

Respondr is an AI-powered emergency response platform designed to bridge the critical gap between a medical incident and professional assistance. In emergency situations such as cardiac arrest, seizures, or severe injury, immediate guidance can significantly improve outcomes. Respondr connects patients to verified doctors and trained volunteers in real time while securely sharing live health data from wearable devices.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.11+)

---

### 🖥️ Frontend (React + Vite)

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

---

### 🧠 Backend (FastAPI)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # macOS/Linux:
   source venv/bin/activate
   # Windows:
   venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:3001`.

## 🏗️ Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS v4, Lucide React, Axios, Supabase JS.
- **Backend**: FastAPI, SQLAlchemy, Uvicorn, PyJWT.
- **Database/Auth**: Supabase.
