from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import os
import httpx
import json
from openai import OpenAI
from fastapi import APIRouter, Depends, HTTPException, Query
from utils.supabase_client import supabase, supabase_admin
from routes.auth import get_current_user

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    return OpenAI(api_key=api_key)

router = APIRouter(prefix="/api/reports", tags=["reports"])

REALTIME_METRICS = [
    "active_energy",
    "heart_rate",
    "respiratory_rate",
    "step_count"
]

AGGREGATED_METRICS = [
    "apple_exercise_time",
    "apple_sleeping_wrist_temperature",
    "apple_stand_hour",
    "apple_stand_time",
    "basal_energy_burned",
    "blood_oxygen_saturation",
    "headphone_audio_exposure",
    "heart_rate_variability",
    "resting_heart_rate",
    "time_in_daylight"
]

async def get_user_email(user_id: str) -> Optional[str]:
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("email")
            else:
                print(f"Error fetching user {user_id}: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"Error fetching email for user {user_id}: {e}")
        return None

@router.get("/patients")
async def get_doctor_patients(user=Depends(get_current_user)):
    doctor_id = user.id
    print(f"[REPORTS_PATIENTS] Doctor ID from token: {doctor_id}")
    print(f"[REPORTS_PATIENTS] Doctor email: {user.email}")
    
    try:
        doctor_links_response = supabase.table("patient_doctor_links").select("patient_id").eq("doctor_id", doctor_id).eq("status", "active").execute()
        print(f"[REPORTS_PATIENTS] Query result count: {len(doctor_links_response.data)}")
        print(f"[REPORTS_PATIENTS] Query result: {doctor_links_response.data}")
        
        if not doctor_links_response.data:
            print(f"[REPORTS_PATIENTS] No patient links found for doctor {doctor_id}")
            return {"patients": []}
        
        doctor_patient_ids = [link["patient_id"] for link in doctor_links_response.data]
        print(f"[REPORTS_PATIENTS] Patient IDs to fetch: {doctor_patient_ids}")
        
        patient_profiles = []
        for patient_id in doctor_patient_ids:
            try:
                profile_response = supabase.table("profiles").select("id, full_name").eq("id", patient_id).execute()
                print(f"[REPORTS_PATIENTS] Profile result for {patient_id}: {profile_response.data}")
                if profile_response.data:
                    patient_profiles.append(profile_response.data[0])
            except Exception as e:
                print(f"[REPORTS_PATIENTS] Error fetching profile for {patient_id}: {e}")
        
        print(f"[REPORTS_PATIENTS] Returning {len(patient_profiles)} patient profiles")
        return {"patients": patient_profiles}
    except Exception as e:
        print(f"[REPORTS_PATIENTS] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_available_metrics(user=Depends(get_current_user)):
    try:
        return {
            "realtime": REALTIME_METRICS,
            "aggregated": AGGREGATED_METRICS
        }
    except Exception as e:
        print(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data")
async def get_report_data(
    user=Depends(get_current_user),
    patient_id: str = Query(..., description="Patient ID"),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    metrics: List[str] = Query(default=[], description="Comma-separated metric names")
):
    doctor_id = user.id
    try:
        doctor_patient_check = supabase.table("patient_doctor_links").select("*").eq("doctor_id", doctor_id).eq("patient_id", patient_id).eq("status", "active").execute()
        
        if not doctor_patient_check.data:
            raise HTTPException(status_code=403, detail="You don't have access to this patient's data")
        
        patient_profile_response = supabase.table("profiles").select("id, full_name").eq("id", patient_id).execute()
        patient_email = await get_user_email(patient_id)
        
        if not patient_email:
            raise HTTPException(status_code=404, detail="Patient email not found")
        
        start_datetime = datetime.strptime(start_date, "%Y-%m-%d").isoformat()
        end_datetime = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).isoformat()
        
        result_data = {
            "patient": patient_profile_response.data[0] if patient_profile_response.data else {},
            "start_date": start_date,
            "end_date": end_date,
            "realtime_data": {},
            "aggregated_data": {}
        }
        
        requested_metrics = metrics if metrics else REALTIME_METRICS + AGGREGATED_METRICS
        
        for metric in requested_metrics:
            if metric in REALTIME_METRICS:
                realtime_response = supabase.table("health_realtime").select("metric_name, timestamp, value, source").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime).lt("timestamp", end_datetime).order("timestamp", desc=True).execute()
                
                if realtime_response.data:
                    result_data["realtime_data"][metric] = realtime_response.data
            
            elif metric in AGGREGATED_METRICS:
                aggregated_response = supabase.table("health_aggregated").select("metric_name, timestamp, value, units").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime).lt("timestamp", end_datetime).order("timestamp", desc=True).execute()
                
                if aggregated_response.data:
                    result_data["aggregated_data"][metric] = aggregated_response.data
        
        return result_data
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        print(f"Error fetching report data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def get_report_summary(
    user=Depends(get_current_user),
    patient_id: str = Query(..., description="Patient ID"),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)")
):
    doctor_id = user.id
    try:
        doctor_patient_check = supabase.table("patient_doctor_links").select("*").eq("doctor_id", doctor_id).eq("patient_id", patient_id).eq("status", "active").execute()
        
        if not doctor_patient_check.data:
            raise HTTPException(status_code=403, detail="You don't have access to this patient's data")
        
        patient_profile_response = supabase.table("profiles").select("id, full_name").eq("id", patient_id).execute()
        patient_email = await get_user_email(patient_id)
        
        if not patient_email:
            raise HTTPException(status_code=404, detail="Patient email not found")
        
        start_datetime = datetime.strptime(start_date, "%Y-%m-%d").isoformat()
        end_datetime = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).isoformat()
        
        summary = {
            "patient": patient_profile_response.data[0] if patient_profile_response.data else {},
            "period": f"{start_date} to {end_date}",
            "metrics_summary": {}
        }
        
        for metric in REALTIME_METRICS:
            realtime_response = supabase.table("health_realtime").select("value").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime).lt("timestamp", end_datetime).execute()
            
            if realtime_response.data:
                values = [float(r["value"]) for r in realtime_response.data if r["value"]]
                summary["metrics_summary"][metric] = {
                    "count": len(values),
                    "average": sum(values) / len(values) if values else None,
                    "min": min(values) if values else None,
                    "max": max(values) if values else None
                }
        
        for metric in AGGREGATED_METRICS:
            aggregated_response = supabase.table("health_aggregated").select("value").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime).lt("timestamp", end_datetime).execute()
            
            if aggregated_response.data:
                values = [float(r["value"]) for r in aggregated_response.data if r["value"]]
                summary["metrics_summary"][metric] = {
                    "count": len(values),
                    "average": sum(values) / len(values) if values else None,
                    "min": min(values) if values else None,
                    "max": max(values) if values else None,
                    "total": sum(values) if values else None
                }
        
        return summary
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        print(f"Error fetching report summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ai-analysis")
async def get_ai_analysis(
    user=Depends(get_current_user),
    patient_id: str = Query(..., description="Patient ID"),
    start_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(None, description="End date (YYYY-MM-DD)")
):
    doctor_id = user.id
    try:
        doctor_patient_check = supabase.table("patient_doctor_links").select("*").eq("doctor_id", doctor_id).eq("patient_id", patient_id).eq("status", "active").execute()
        
        if not doctor_patient_check.data:
            raise HTTPException(status_code=403, detail="You don't have access to this patient's data")
        
        patient_email = await get_user_email(patient_id)
        
        if not patient_email:
            raise HTTPException(status_code=404, detail="Patient email not found")
        
        if not start_date:
            start_date = datetime.now().date().isoformat()
        if not end_date:
            end_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        
        start_datetime = datetime.fromisoformat(start_date)
        end_datetime = datetime.fromisoformat(end_date) + timedelta(days=1)
        
        realtime_metrics = ['heart_rate', 'respiratory_rate', 'active_energy']
        aggregated_metrics = [
            'apple_sleeping_wrist_temperature',
            'blood_oxygen_saturation',
            'heart_rate_variability',
            'resting_heart_rate'
        ]
        
        metrics_data = {}
        
        for metric in realtime_metrics:
            response = supabase.table("health_realtime").select("value, timestamp").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime.isoformat()).lt("timestamp", end_datetime.isoformat()).execute()
            if response.data:
                metrics_data[metric] = response.data
        
        for metric in aggregated_metrics:
            response = supabase.table("health_aggregated").select("value, timestamp").eq("email", patient_email).eq("metric_name", metric).gte("timestamp", start_datetime.isoformat()).lt("timestamp", end_datetime.isoformat()).execute()
            if response.data:
                metrics_data[metric] = response.data
        
        if not metrics_data:
            return {
                "analysis": "No health data available for the selected date range.",
                "date_range": f"{start_date} to {end_date}"
            }
        
        prompt = f"""You are a medical assistant analyzing patient health data. Here is the health data for the patient:

Date Range: {start_date} to {end_date}

Metrics Data:
{json.dumps(metrics_data, indent=2, default=str)}

Please provide a professional health analysis report for doctors based on this data. Include:
1. Summary of key metrics
2. Any notable patterns or trends
3. Recommendations for monitoring or follow-up
4. Any potential concerns to watch for

Keep the report concise but informative."""

        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a medical assistant analyzing patient health data for doctors."},
                {"role": "user", "content": prompt}
            ]
        )
        
        analysis_text = response.choices[0].message.content if response.choices else "Unable to generate analysis"
        
        return {
            "analysis": analysis_text,
            "patient_id": patient_id,
            "date_range": f"{start_date} to {end_date}",
            "metrics_included": list(metrics_data.keys())
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating AI analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
