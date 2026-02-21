import os
import asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from utils.supabase_client import supabase
from routes.auth import get_current_user
from services.health import (
    insert_realtime_data, 
    insert_aggregated_data, 
    fetch_metric,
    upsert_sleep_data
)
from services.alerts import run_hourly_alert_check
from routes.dashboard import router as dashboard_router
from routes.video_calls import router as video_calls_router

app = FastAPI(title="Respondr API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()

def start_scheduler():
    def async_wrapper():
        asyncio.run(run_hourly_alert_check())
    
    scheduler.add_job(async_wrapper, "interval", hours=1)
    scheduler.start()
    print("Alert scheduler started - will run every hour")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("Alert scheduler shut down")

app.add_event_handler("startup", start_scheduler)
app.add_event_handler("shutdown", stop_scheduler)

app.include_router(dashboard_router)
app.include_router(video_calls_router)

@app.get("/")
async def root():
    return {"message": "Welcome to Respondr API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/admin/run-alert-check")
async def trigger_alert_check():
    await run_hourly_alert_check()
    return {"status": "Alert check completed"}

@app.get("/me")
async def get_me(user=Depends(get_current_user)):
    profile = supabase.table('profiles').select('*').eq('id', user.id).single().execute()
    return {"user": user, "profile": profile.data}

@app.post("/api/data")
async def ingest_health_data(request: Request):
    try:
        print(f"\n=== INCOMING REQUEST ===")
        print(f"Headers: {dict(request.headers)}")
        
        # Check for authentication header
        auth_header = request.headers.get("Authorization")
        email = None
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                user = supabase.auth.get_user(token)
                if user.user:
                    email = user.user.email
            except:
                pass
        
        # Fallback to default email if no token (for phone app local testing)
        if not email:
            email = os.getenv("DEFAULT_EMAIL")
            if not email:
                return {"success": False, "message": "Unauthorized - No user session and no DEFAULT_EMAIL configured"}
            print(f"Using default email: {email}")
        
        body = await request.json()
        print(f"Request body: {body}")
        
        data = body.get("data", {})
        metrics = data.get("metrics", [])
        
        print(f"Metrics received: {len(metrics)} items")
        
        if not metrics:
            return {"success": False, "message": "No metrics found in request"}

        total_inserted = 0
        
        # Realtime vs Aggregated mapping (simplified logic from previous server)
        realtime_metrics = ["heart_rate", "step_count", "active_energy", "respiratory_rate"]
        
        for metric in metrics:
            name = metric.get("name")
            samples = metric.get("data", [])
            units = metric.get("units")
            
            if name in realtime_metrics:
                total_inserted += await insert_realtime_data(email, name, samples)
            else:
                total_inserted += await insert_aggregated_data(email, name, samples, units)

        return {
            "success": True, 
            "message": f"Successfully ingested {total_inserted} records",
            "inserted": total_inserted
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/health/ingest")
async def ingest_from_api(user=Depends(get_current_user)):
    try:
        email = user.email
        days_back = int(os.getenv("DAYS_BACK", "7"))
        end = datetime.now()
        start = end - timedelta(days=days_back)
        
        params = {
            "start": start.isoformat(),
            "end": end.isoformat()
        }
        
        # Mapping from endpoint to metric name and type
        metrics_to_fetch = [
            {"endpoint": "/heart-rate", "name": "heart_rate", "type": "realtime", "units": "count/min"},
            {"endpoint": "/steps", "name": "step_count", "type": "realtime", "units": "count"},
            {"endpoint": "/active-energy", "name": "active_energy", "type": "realtime", "units": "kcal"},
            {"endpoint": "/respiratory-rate", "name": "respiratory_rate", "type": "realtime", "units": "count/min"},
            {"endpoint": "/exercise-time", "name": "apple_exercise_time", "type": "aggregated", "units": "min"},
            {"endpoint": "/time-in-daylight", "name": "time_in_daylight", "type": "aggregated", "units": "min"},
            {"endpoint": "/hrv", "name": "heart_rate_variability", "type": "aggregated", "units": "ms"},
            {"endpoint": "/sleep-analysis", "name": "sleep_analysis", "type": "sleep", "units": "hr"}
        ]
        
        total_inserted = 0
        results = []
        
        for m in metrics_to_fetch:
            samples = await fetch_metric(m["endpoint"], params, m["units"])
            if samples:
                if m["type"] == "realtime":
                    inserted = await insert_realtime_data(email, m["name"], samples)
                elif m["type"] == "sleep":
                    inserted = await upsert_sleep_data(email, samples)
                else:
                    inserted = await insert_aggregated_data(email, m["name"], samples, m["units"])
                
                total_inserted += inserted
                results.append({"metric": m["name"], "inserted": inserted})

        return {
            "success": True,
            "message": f"Successfully ingested {total_inserted} records from API",
            "inserted": total_inserted,
            "details": results
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
