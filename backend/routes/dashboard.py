import httpx
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from utils.supabase_client import supabase
from routes.auth import get_current_user
from services.alerts import check_alerts_for_user
from collections import defaultdict

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def calculate_pct_change(current: float, previous: float) -> float:
    if not previous or previous == 0:
        return 0.0
    return ((current - previous) / previous) * 100

@router.get("/summary")
async def get_dashboard_summary(user=Depends(get_current_user)):
    email = user.email

    now = datetime.now()
    today = now.date()
    yesterday = today - timedelta(days=1)

    rt_metrics = ['heart_rate', 'respiratory_rate', 'step_count', 'active_energy']
    agg_metrics = [
        'blood_oxygen_saturation', 'heart_rate_variability', 
        'resting_heart_rate', 'time_in_daylight', 
        'apple_exercise_time', 'basal_energy_burned'
    ]

    try:
        # 1) Latest Vitals (KPIs) and 2) Today Summary combined
        today_iso = today.isoformat()
        
        # Combined Realtime Query
        rt_res = supabase.table("health_realtime").select("*").eq("email", email).gte("timestamp", today_iso).execute()
        
        # Group and calculate latest/summary
        rt_by_metric = defaultdict(list)
        for r in rt_res.data:
            rt_by_metric[r["metric_name"]].append(r)
            
        latest_rt = {}
        for m in rt_metrics:
            m_data = rt_by_metric[m]
            if m_data:
                m_data.sort(key=lambda x: x["timestamp"], reverse=True)
                latest_rt[m] = m_data[0]
            else:
                latest_rt[m] = None

        hr_values = [r["value"] for r in rt_by_metric["heart_rate"]]
        rr_values = [r["value"] for r in rt_by_metric["respiratory_rate"]]
        steps_today = sum([r["value"] for r in rt_by_metric["step_count"]])
        energy_today = sum([r["value"] for r in rt_by_metric["active_energy"]])
        
        # Combined Aggregated Query
        agg_res = supabase.table("health_aggregated").select("*").eq("email", email).gte("timestamp", today_iso).execute()
        
        agg_by_metric = defaultdict(list)
        for r in agg_res.data:
            agg_by_metric[r["metric_name"]].append(r)
            
        latest_agg = {}
        for m in agg_metrics:
            m_data = agg_by_metric[m]
            if m_data:
                m_data.sort(key=lambda x: x["timestamp"], reverse=True)
                latest_agg[m] = m_data[0]
            else:
                latest_agg[m] = None

        daylight_today = sum([r["value"] for r in agg_by_metric["time_in_daylight"]])
        exercise_today = sum([r["value"] for r in agg_by_metric["apple_exercise_time"]])

        return {
            "latest": {**latest_rt, **latest_agg},
            "today": {
                "avg_hr": sum(hr_values)/len(hr_values) if hr_values else 0,
                "avg_rr": sum(rr_values)/len(rr_values) if rr_values else 0,
                "steps": round(steps_today),
                "active_energy": round(energy_today),
                "daylight_min": round(daylight_today),
                "exercise_min": round(exercise_today)
            }
        }
    except Exception as e:
        print(f"Summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trends")
async def get_dashboard_trends(user=Depends(get_current_user), metric: str = "heart_rate", days: int = 7):
    email = user.email

    now = datetime.now()
    start_date = now - timedelta(days=days)

    try:
        if metric == 'heart_rate' and days == 1:
            # Special case for 24h HR chart with more granularity
            res = supabase.table("health_realtime").select("timestamp, value").eq("email", email).eq("metric_name", metric).gte("timestamp", start_date.isoformat()).order("timestamp").execute()
            # For 24h we might want to downsample in Python if there's too much data
            return res.data
            
        if metric in ['heart_rate', 'respiratory_rate', 'step_count', 'active_energy']:
            res = supabase.table("health_realtime").select("timestamp, value").eq("email", email).eq("metric_name", metric).gte("timestamp", start_date.isoformat()).order("timestamp").execute()
        else:
            res = supabase.table("health_aggregated").select("timestamp, value").eq("email", email).eq("metric_name", metric).gte("timestamp", start_date.isoformat()).order("timestamp").execute()
            
        return res.data
    except Exception as e:
        print(f"Trends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vitals")
async def get_vitals_page(user=Depends(get_current_user)):
    email = user.email

    try:
        now = datetime.now()
        today_iso = now.date().isoformat()

        rt_metrics = ['heart_rate', 'respiratory_rate', 'step_count', 'active_energy']
        agg_metrics = [
            'blood_oxygen_saturation', 'heart_rate_variability', 'resting_heart_rate',
            'apple_sleeping_wrist_temperature', 'apple_exercise_time', 'apple_stand_hour',
            'apple_stand_time', 'basal_energy_burned', 'time_in_daylight', 'headphone_audio_exposure'
        ]
        
        # Cumulative metrics should show daily total
        cumulative_metrics = [
            'step_count', 'active_energy', 'apple_exercise_time', 
            'apple_stand_time', 'basal_energy_burned', 'time_in_daylight'
        ]

        vitals = {}
        
        # Fetch Realtime (last 48h only for performance)
        rt_res = supabase.table("health_realtime").select("metric_name, value, timestamp, source").eq("email", email).gte("timestamp", (now - timedelta(days=2)).isoformat()).execute()
        
        # Fetch Aggregated (last 48h only for performance)
        agg_res = supabase.table("health_aggregated").select("metric_name, value, timestamp, units").eq("email", email).gte("timestamp", (now - timedelta(days=2)).isoformat()).execute()

        # Process RT metrics
        for m in rt_metrics:
            m_data = [r for r in rt_res.data if r["metric_name"] == m]
            if not m_data:
                vitals[m] = None
                continue
            
            if m in cumulative_metrics:
                # Sum for today
                today_total = sum([r["value"] for r in m_data if r["timestamp"].startswith(today_iso)])
                vitals[m] = {"value": today_total, "timestamp": now.isoformat()}
            else:
                # Latest
                m_data.sort(key=lambda x: x["timestamp"], reverse=True)
                vitals[m] = m_data[0]

        # Process Agg metrics
        for m in agg_metrics:
            m_data = [r for r in agg_res.data if r["metric_name"] == m]
            if not m_data:
                vitals[m] = None
                continue

            if m in cumulative_metrics:
                # Sum for today
                today_total = sum([r["value"] for r in m_data if r["timestamp"].startswith(today_iso)])
                vitals[m] = {"value": today_total, "timestamp": now.isoformat(), "units": m_data[0].get("units")}
            else:
                # Latest
                m_data.sort(key=lambda x: x["timestamp"], reverse=True)
                vitals[m] = m_data[0]

        return vitals
    except Exception as e:
        print(f"Vitals error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-alerts")
async def check_alerts(user=Depends(get_current_user)):
    email = user.email
    user_id = user.id
    try:
        result = await check_alerts_for_user(email=email, patient_id=user_id)
        return result
    except Exception as e:
        print(f"Check alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doctor-alerts")
async def get_doctor_alerts(user=Depends(get_current_user), status: str = "open"):
    doctor_id = user.id
    try:
        alert_query = supabase_admin.table("alerts").select("*")
        
        if status:
            alert_query = alert_query.eq("status", status)
        
        alerts_response = alert_query.order("created_at", desc=True).execute()
        all_alerts = alerts_response.data or []
        
        print(f"[DOCTOR_ALERTS] Found {len(all_alerts)} alerts with status='{status}'")
        for alert in all_alerts:
            print(f"[DOCTOR_ALERTS] Alert ID: {alert['id']}, Patient: {alert['patient_email']}, Title: {alert['title']}")
        
        patient_ids = set(alert["patient_id"] for alert in all_alerts)
        patient_profiles = {}
        
        for patient_id in patient_ids:
            try:
                profile_response = supabase_admin.table("profiles").select("id, full_name, email").eq("id", patient_id).single().execute()
                if profile_response.data:
                    patient_profiles[patient_id] = profile_response.data
            except:
                pass
        
        return {
            "alerts": all_alerts,
            "patients": patient_profiles,
            "status_filter": status
        }
    except Exception as e:
        print(f"Error fetching doctor alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, user=Depends(get_current_user)):
    doctor_id = user.id
    try:
        alert_response = supabase.table("alerts").select("*").eq("id", alert_id).single().execute()
        
        if not alert_response.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        patient_id = alert_response.data["patient_id"]
        
        doctor_patient_check = supabase.table("patient_doctor_links").select("*").eq("doctor_id", doctor_id).eq("patient_id", patient_id).eq("status", "active").execute()
        
        if not doctor_patient_check.data:
            raise HTTPException(status_code=403, detail="You don't have access to this patient's alerts")
        
        update_response = supabase.table("alerts").update({
            "status": "acknowledged",
            "acknowledged_by": doctor_id,
            "acknowledged_at": datetime.now().isoformat()
        }).eq("id", alert_id).execute()
        
        return {"success": True, "alert": update_response.data[0] if update_response.data else None}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))
