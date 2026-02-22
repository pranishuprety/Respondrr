import os
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from utils.supabase_client import supabase
from routes.auth import get_current_user
from services.health import (
    insert_realtime_data, 
    insert_aggregated_data, 
    fetch_metric,
    upsert_sleep_data
)
from services.alerts import run_hourly_alert_check, get_all_user_emails
from services.emergency import check_vitals_and_trigger_emergency
from services.queue import process_emergency_check_queue
from routes.dashboard import router as dashboard_router
from routes.video_calls import router as video_calls_router
from routes.reports import router as reports_router

app = FastAPI(title="Respondr API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()

async def run_hourly_emergency_check() -> None:
    print(f"\n{'='*50}")
    print(f"Running hourly emergency check at {datetime.now(timezone.utc)}")
    print(f"{'='*50}")
    
    try:
        emails = await get_all_user_emails()
        print(f"Found {len(emails)} users to check for emergencies")
        
        for email in emails:
            try:
                result = await check_vitals_and_trigger_emergency(email)
                if result:
                    print(f"✓ Emergency triggered for {email}")
                else:
                    print(f"✓ No emergency needed for {email}")
            except Exception as e:
                print(f"Error checking emergency for {email}: {e}")
        
        print(f"Hourly emergency check completed at {datetime.now(timezone.utc)}")
    except Exception as e:
        print(f"Error in run_hourly_emergency_check: {e}")
        import traceback
        traceback.print_exc()

async def run_startup_checks():
    try:
        print("\n" + "="*50)
        print("Running startup emergency check...")
        print("="*50)
        await run_hourly_emergency_check()
    except Exception as e:
        print(f"Error in startup emergency check: {e}")
        import traceback
        traceback.print_exc()

def start_scheduler():
    try:
        scheduler.add_job(run_hourly_alert_check, "interval", hours=1, id="hourly_alert_check", misfire_grace_time=60)
        scheduler.add_job(run_hourly_emergency_check, "interval", hours=1, id="hourly_emergency_check", misfire_grace_time=60)
        scheduler.add_job(process_emergency_check_queue, "interval", seconds=30, id="emergency_queue_processor", misfire_grace_time=10)
        scheduler.start()
        print("✓ Schedulers started - emergency queue will process every 30 seconds")
        asyncio.ensure_future(run_startup_checks())
    except Exception as e:
        print(f"Error starting scheduler: {e}")
        import traceback
        traceback.print_exc()

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("✓ Schedulers shut down")

app.add_event_handler("startup", start_scheduler)
app.add_event_handler("shutdown", stop_scheduler)

app.include_router(dashboard_router)
app.include_router(video_calls_router)
app.include_router(reports_router)

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

@app.get("/admin/check-emergency")
async def check_emergency_for_user(email: str):
    print(f"\n[ENDPOINT] /admin/check-emergency called with email: {email}")
    try:
        result = await check_vitals_and_trigger_emergency(email)
        print(f"[ENDPOINT] Result from check_vitals_and_trigger_emergency: {result}")
        if result:
            return {"status": "emergency_triggered", "data": result}
        else:
            return {"status": "no_emergency", "message": "No abnormal vitals found or no emergency created"}
    except Exception as e:
        print(f"[ENDPOINT] Exception: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/api/emergency/active")
async def get_active_emergency(user=Depends(get_current_user)):
    try:
        patient_id = user.id
        response = supabase.table("emergencies").select("*").eq("patient_id", patient_id).eq("status", "active").execute()
        
        if response.data and len(response.data) > 0:
            emergency = response.data[0]
            return {
                "has_emergency": True,
                "emergency": emergency
            }
        else:
            return {
                "has_emergency": False,
                "emergency": None
            }
    except Exception as e:
        print(f"Error getting active emergency: {e}")
        return {"has_emergency": False, "emergency": None, "error": str(e)}

@app.post("/api/emergency/{emergency_id}/initiate-call")
async def initiate_emergency_call(emergency_id: str, user=Depends(get_current_user)):
    try:
        patient_id = user.id
        
        emergency_response = supabase.table("emergencies").select("*").eq("id", emergency_id).single().execute()
        
        if not emergency_response.data:
            return {"success": False, "error": "Emergency not found"}
        
        emergency = emergency_response.data
        if emergency["patient_id"] != patient_id:
            return {"success": False, "error": "Unauthorized"}
        
        if emergency.get("video_call_id"):
            return {"success": False, "error": "Video call already initiated"}
        
        conversation_id = emergency["conversation_id"]
        
        from services.video_call import create_room, get_room_token
        
        room_response = await create_room(conversation_id, recording_enabled=False)
        print(f"[EMERGENCY_CALL] Room response: {room_response}")
        
        if not room_response.get("success"):
            return {"success": False, "error": room_response.get("error")}
        
        room_name = room_response.get("room_name")
        room_url = room_response.get("room_url")
        
        video_call_data = {
            "conversation_id": conversation_id,
            "provider": "daily",
            "room_name": room_name,
            "room_url": room_url,
            "started_by": patient_id,
            "status": "ringing",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        video_response = supabase.table("video_calls").insert(video_call_data).execute()
        print(f"[EMERGENCY_CALL] Video call insert response: {video_response.data}")
        
        if not video_response.data:
            return {"success": False, "error": "Failed to create video call record"}
        
        video_call_id = video_response.data[0]["id"]
        
        supabase.table("emergencies").update({
            "video_call_id": str(video_call_id)
        }).eq("id", emergency_id).execute()
        
        token_response = await get_room_token(room_name, patient_id)
        
        if not token_response.get("success"):
            return {"success": False, "error": "Failed to generate token"}
        
        return {
            "success": True,
            "call_id": video_call_id,
            "room_name": room_name,
            "room_url": room_url,
            "token": token_response.get("token")
        }
        
    except Exception as e:
        print(f"[EMERGENCY_CALL] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@app.post("/api/emergency/{emergency_id}/resolve")
async def resolve_emergency(emergency_id: str, user=Depends(get_current_user)):
    try:
        emergency_response = supabase.table("emergencies").select("*").eq("id", emergency_id).single().execute()
        
        if not emergency_response.data:
            return {"status": "error", "message": "Emergency not found"}
        
        emergency = emergency_response.data
        if emergency["patient_id"] != user.id:
            return {"status": "error", "message": "Unauthorized"}
        
        update_response = supabase.table("emergencies").update({
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", emergency_id).execute()
        
        return {"status": "success", "message": "Emergency resolved"}
    except Exception as e:
        print(f"Error resolving emergency: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/emergency/{emergency_id}/reject")
async def reject_emergency(emergency_id: str, user=Depends(get_current_user)):
    try:
        print(f"[EMERGENCY] Rejecting emergency {emergency_id} by {user.id}")
        
        emergency_response = supabase.table("emergencies").select("*").eq("id", emergency_id).single().execute()
        
        if not emergency_response.data:
            return {"success": False, "error": "Emergency not found"}
        
        emergency = emergency_response.data
        if emergency["patient_id"] != user.id:
            return {"success": False, "error": "Unauthorized"}
        
        video_call_id = emergency.get("video_call_id")
        
        if video_call_id:
            try:
                supabase.table("video_calls").update({
                    "status": "missed"
                }).eq("id", video_call_id).execute()
                print(f"[EMERGENCY] Marked video call {video_call_id} as missed")
            except Exception as e:
                print(f"[EMERGENCY] Error updating video call: {e}")
        
        supabase.table("emergencies").update({
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", emergency_id).execute()
        
        print(f"[EMERGENCY] Emergency {emergency_id} rejected and resolved")
        return {"success": True, "message": "Emergency rejected"}
        
    except Exception as e:
        print(f"[EMERGENCY] Error rejecting emergency: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@app.get("/admin/recent-vitals")
async def get_recent_vitals(email: str, limit: int = 20):
    try:
        print(f"\n[DEBUG_VITALS] Fetching recent vitals for {email} (limit: {limit})")
        
        realtime = supabase.table("health_realtime").select("*").eq("email", email).order("timestamp", desc=True).limit(limit).execute()
        aggregated = supabase.table("health_aggregated").select("*").eq("email", email).order("timestamp", desc=True).limit(limit).execute()
        
        realtime_data = realtime.data or []
        aggregated_data = aggregated.data or []
        
        print(f"[DEBUG_VITALS] Realtime records: {len(realtime_data)}")
        for r in realtime_data:
            print(f"  - {r.get('metric_name')}: {r.get('value')} at {r.get('timestamp')}")
        
        print(f"[DEBUG_VITALS] Aggregated records: {len(aggregated_data)}")
        for r in aggregated_data:
            print(f"  - {r.get('metric_name')}: {r.get('value')} ({r.get('units')}) at {r.get('timestamp')}")
        
        return {
            "email": email,
            "realtime_count": len(realtime_data),
            "realtime": realtime_data,
            "aggregated_count": len(aggregated_data),
            "aggregated": aggregated_data
        }
    except Exception as e:
        print(f"[DEBUG_VITALS] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

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
        
        print(f"\n{'='*60}")
        print(f"[API_DATA] Processing {len(metrics)} metrics for {email}")
        print(f"{'='*60}")
        
        for metric in metrics:
            name = metric.get("name")
            samples = metric.get("data", [])
            units = metric.get("units")
            
            print(f"[API_DATA] Processing metric: {name} with {len(samples)} samples")
            
            if name in realtime_metrics:
                inserted = await insert_realtime_data(email, name, samples)
                print(f"[API_DATA] Inserted {inserted} realtime records for {name}")
                total_inserted += inserted
            else:
                inserted = await insert_aggregated_data(email, name, samples, units)
                print(f"[API_DATA] Inserted {inserted} aggregated records for {name}")
                total_inserted += inserted

        print(f"[API_DATA] Total inserted: {total_inserted}")
        print(f"[API_DATA] Emergency check will be queued automatically via database triggers")
        print(f"{'='*60}\n")
        
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

        print(f"[API_HEALTH_INGEST] Emergency check will be queued automatically via database triggers")

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
