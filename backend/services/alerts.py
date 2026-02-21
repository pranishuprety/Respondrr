import os
import json
import time
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import google.genai as genai
from utils.supabase_client import supabase, supabase_admin

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

MAX_RETRIES = 3
RETRY_DELAY = 2


def normalize_metric_name(name: str) -> str:
    mapping = {
        'heartRate': 'heart_rate',
        'heart_rate': 'heart_rate',
        'respiratoryRate': 'respiratory_rate',
        'respiratory_rate': 'respiratory_rate',
        'activeEnergy': 'active_energy',
        'active_energy': 'active_energy',
        'activeEnergyBurned': 'active_energy',
        'oxygenSaturation': 'blood_oxygen_saturation',
        'blood_oxygen_saturation': 'blood_oxygen_saturation',
    }
    return mapping.get(name, name)

def normalize_severity(severity: str) -> str:
    severity_lower = severity.lower()
    if 'critical' in severity_lower or 'emergency' in severity_lower or 'dangerously' in severity_lower:
        return 'critical'
    elif 'high' in severity_lower or 'significantly' in severity_lower:
        return 'high'
    elif 'medium' in severity_lower or 'moderate' in severity_lower:
        return 'medium'
    elif 'low' in severity_lower or 'slight' in severity_lower:
        return 'low'
    else:
        return 'info'

async def fetch_user_health_metrics(email: str) -> Optional[List[Dict[str, Any]]]:
    try:
        now = datetime.now(timezone.utc)
        hour_start = now - timedelta(hours=1)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        realtime_response = supabase.table("health_realtime").select("*").eq("email", email).gte("timestamp", day_start.isoformat()).execute()
        aggregated_response = supabase.table("health_aggregated").select("*").eq("email", email).gte("timestamp", day_start.isoformat()).execute()
        
        all_data = (realtime_response.data or []) + (aggregated_response.data or [])
        
        if not all_data:
            return []
        
        metrics_by_name = {}
        for item in all_data:
            normalized_name = normalize_metric_name(item.get("metric_name"))
            if normalized_name not in metrics_by_name:
                metrics_by_name[normalized_name] = []
            metrics_by_name[normalized_name].append(item)
        
        target_metrics = {
            'heart_rate', 'respiratory_rate', 'active_energy',
            'apple_sleeping_wrist_temperature', 'blood_oxygen_saturation',
            'heart_rate_variability', 'resting_heart_rate'
        }
        
        result = []
        for metric_name, values in metrics_by_name.items():
            if metric_name not in target_metrics:
                continue
            
            values_float = []
            last_hour_values = []
            last_hour_current = None
            last_hour_current_ts = None
            
            sorted_values = sorted(values, key=lambda x: x.get("timestamp", ""), reverse=True)
            
            for v in values:
                try:
                    val = float(v.get("value", 0))
                    values_float.append(val)
                    
                    ts_str = v.get("timestamp")
                    if ts_str:
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                        if ts >= hour_start:
                            last_hour_values.append(val)
                except (ValueError, TypeError):
                    continue
            
            if sorted_values and sorted_values[0].get("timestamp"):
                try:
                    ts = datetime.fromisoformat(sorted_values[0].get("timestamp").replace("Z", "+00:00"))
                    if sorted_values[0].get("value"):
                        last_hour_current = float(sorted_values[0].get("value"))
                        last_hour_current_ts = sorted_values[0].get("timestamp")
                except (ValueError, TypeError):
                    pass
            
            result.append({
                "metric_name": metric_name,
                "last_hour_current": last_hour_current,
                "last_hour_current_ts": last_hour_current_ts,
                "last_hour_avg": sum(last_hour_values) / len(last_hour_values) if last_hour_values else None,
                "last_hour_low": min(last_hour_values) if last_hour_values else None,
                "last_hour_high": max(last_hour_values) if last_hour_values else None,
                "today_avg": sum(values_float) / len(values_float) if values_float else None,
                "today_low": min(values_float) if values_float else None,
                "today_high": max(values_float) if values_float else None
            })
        
        return result
        
    except Exception as e:
        print(f"Error fetching health metrics for {email}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def analyze_metrics_with_gemini(email: str, metrics: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    try:
        if not metrics:
            return None

        metrics_summary = []
        for m in metrics:
            summary = f"{m['metric_name']}: curr={m.get('last_hour_current')}, hr_avg={m.get('last_hour_avg')}, today_avg={m.get('today_avg')}"
            metrics_summary.append(summary)
        
        metrics_text = "\n".join(metrics_summary)
        
        prompt = f"""Analyze health metrics and identify concerning values:
{metrics_text}

Normal ranges: HR 60-100, RR 12-20, HRV 20-200ms, SpO2 95-100%, RHR 60-100

Return JSON: {{"has_alerts": bool, "alerts": [{{"metric_name": str, "severity": str, "title": str, "message": str, "reason": str}}], "summary": str}}
"""
        
        for attempt in range(MAX_RETRIES):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                
                try:
                    text = response.text.strip()
                    if text.startswith("```json"):
                        text = text[7:]
                    if text.startswith("```"):
                        text = text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    text = text.strip()
                    
                    analysis = json.loads(text)
                    return analysis
                except json.JSONDecodeError:
                    print(f"Failed to parse Gemini response as JSON: {response.text}")
                    return None
                    
            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "quota" in error_str.lower():
                    if attempt < MAX_RETRIES - 1:
                        wait_time = RETRY_DELAY * (2 ** attempt)
                        print(f"Rate limited. Retrying in {wait_time}s (attempt {attempt + 1}/{MAX_RETRIES})...")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"Rate limit exceeded after {MAX_RETRIES} attempts: {e}")
                        return None
                else:
                    print(f"Error analyzing metrics with Gemini: {e}")
                    return None
            
    except Exception as e:
        print(f"Unexpected error in analyze_metrics_with_gemini: {e}")
        return None


async def get_patient_id(email: str) -> Optional[str]:
    try:
        print(f"[GET_PATIENT_ID] Looking up ID for email: {email}")
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key
                },
                params={"query": email}
            )
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                for user in users:
                    if user.get("email") == email:
                        patient_id = user.get("id")
                        print(f"[GET_PATIENT_ID] Found patient ID: {patient_id}")
                        return patient_id
        
        print(f"[GET_PATIENT_ID] No user found for {email}")
        return None
    except Exception as e:
        print(f"[GET_PATIENT_ID] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def get_patient_doctor(patient_id: str) -> Optional[str]:
    try:
        response = supabase.table("patient_doctor_links").select("doctor_id").eq("patient_id", patient_id).eq("status", "active").single().execute()
        return response.data["doctor_id"] if response.data else None
    except Exception as e:
        print(f"Error fetching doctor for patient {patient_id}: {e}")
        return None


async def create_alert(
    patient_id: str,
    patient_email: str,
    title: str,
    message: str,
    alert_type: str,
    severity: str,
    metadata: Dict[str, Any]
) -> bool:
    try:
        alert_data = {
            "patient_id": patient_id,
            "patient_email": patient_email,
            "title": title,
            "message": message,
            "alert_type": alert_type,
            "severity": severity,
            "status": "open",
            "metadata": metadata,
        }
        
        print(f"[CREATE_ALERT] Starting insertion...")
        print(f"[CREATE_ALERT] Patient ID: {patient_id} (type: {type(patient_id)})")
        print(f"[CREATE_ALERT] Email: {patient_email}")
        print(f"[CREATE_ALERT] Title: {title}")
        print(f"[CREATE_ALERT] Severity: {severity}")
        print(f"[CREATE_ALERT] Alert data: {alert_data}")
        
        response = supabase_admin.table("alerts").insert(alert_data).execute()
        
        print(f"[CREATE_ALERT] Response type: {type(response)}")
        print(f"[CREATE_ALERT] Response status: {response}")
        print(f"[CREATE_ALERT] Response data: {response.data if hasattr(response, 'data') else 'NO DATA ATTR'}")
        
        if hasattr(response, 'data') and response.data:
            if isinstance(response.data, list) and len(response.data) > 0:
                print(f"[CREATE_ALERT] ✓ Successfully inserted with ID: {response.data[0].get('id')}")
                return True
            elif isinstance(response.data, dict):
                print(f"[CREATE_ALERT] ✓ Successfully inserted with ID: {response.data.get('id')}")
                return True
            else:
                print(f"[CREATE_ALERT] ✗ Response data is not list/dict: {type(response.data)}")
                return False
        else:
            print(f"[CREATE_ALERT] ✗ No data in response")
            return False
    except Exception as e:
        print(f"[CREATE_ALERT] ✗ Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


async def process_alerts_for_user(email: str) -> None:
    try:
        print(f"Processing alerts for {email}...")
        
        metrics = await fetch_user_health_metrics(email)
        if not metrics:
            print(f"No metrics found for {email}")
            return
        
        print(f"Found {len(metrics)} metrics for {email}")
        
        analysis = await analyze_metrics_with_gemini(email, metrics)
        if not analysis:
            print(f"Failed to analyze metrics for {email}")
            return
            
        if not analysis.get("has_alerts"):
            print(f"No alerts needed for {email}")
            return
        
        print(f"Analysis indicates alerts needed. Found {len(analysis.get('alerts', []))} alerts")
        
        patient_id = await get_patient_id(email)
        if not patient_id:
            print(f"Patient ID not found for {email}")
            return
        
        print(f"Patient ID: {patient_id}")
        
        alerts = analysis.get("alerts", [])
        for idx, alert in enumerate(alerts):
            try:
                metadata = {
                    "metric_name": alert.get("metric_name"),
                    "reason": alert.get("reason"),
                    "analysis_summary": analysis.get("summary")
                }
                
                normalized_severity = normalize_severity(alert.get("severity", "info"))
                print(f"Processing alert {idx+1}/{len(alerts)}: {alert.get('title')} (severity: {normalized_severity})")
                
                created = await create_alert(
                    patient_id=patient_id,
                    patient_email=email,
                    title=alert.get("title", "Health Alert"),
                    message=alert.get("message", ""),
                    alert_type="health_metric",
                    severity=normalized_severity,
                    metadata=metadata
                )
                
                if created:
                    print(f"✓ Alert created for {email}: {alert.get('title')}")
                else:
                    print(f"✗ Failed to create alert for {email}: {alert.get('title')}")
            except Exception as alert_error:
                print(f"Error creating individual alert: {alert_error}")
                import traceback
                traceback.print_exc()
                
    except Exception as e:
        print(f"Error processing alerts for {email}: {e}")
        import traceback
        traceback.print_exc()


async def get_all_user_emails() -> List[str]:
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))
        
        emails = []
        page = 1
        
        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"{supabase_url}/auth/v1/admin/users",
                    headers={
                        "Authorization": f"Bearer {service_key}",
                        "apikey": service_key
                    },
                    params={"page": page, "per_page": 100}
                )
                if response.status_code == 200:
                    data = response.json()
                    users = data.get("users", [])
                    if not users:
                        break
                    emails.extend([user["email"] for user in users if user.get("email")])
                    page += 1
                else:
                    break
        
        return emails
    except Exception as e:
        print(f"Error fetching user emails: {e}")
        return []


async def check_alerts_for_user(email: str, patient_id: str = None) -> Optional[Dict[str, Any]]:
    try:
        print(f"Checking alerts for {email} at {datetime.now(timezone.utc)}...")
        print(f"[CHECK_ALERTS] Patient ID provided: {patient_id}")
        
        metrics = await fetch_user_health_metrics(email)
        if not metrics:
            print(f"No metrics found for {email}")
            return {
                "has_alerts": False,
                "metrics": [],
                "alerts": [],
                "summary": "No health data available for analysis"
            }
        
        analysis = await analyze_metrics_with_gemini(email, metrics)
        if not analysis:
            return {
                "has_alerts": False,
                "metrics": metrics,
                "alerts": [],
                "summary": "Unable to analyze metrics"
            }
        
        if analysis.get("has_alerts"):
            print(f"Alerts detected for {email}, attempting to insert...")
            if not patient_id:
                print(f"[CHECK_ALERTS] No patient_id provided, attempting to look up...")
                patient_id = await get_patient_id(email)
            else:
                print(f"[CHECK_ALERTS] Using provided patient_id: {patient_id}")
            
            if patient_id:
                alerts = analysis.get("alerts", [])
                for alert in alerts:
                    try:
                        metadata = {
                            "metric_name": alert.get("metric_name"),
                            "reason": alert.get("reason"),
                            "analysis_summary": analysis.get("summary")
                        }
                        
                        normalized_severity = normalize_severity(alert.get("severity", "info"))
                        
                        created = await create_alert(
                            patient_id=patient_id,
                            patient_email=email,
                            title=alert.get("title", "Health Alert"),
                            message=alert.get("message", ""),
                            alert_type="health_metric",
                            severity=normalized_severity,
                            metadata=metadata
                        )
                        
                        if created:
                            print(f"✓ Alert inserted: {alert.get('title')}")
                        else:
                            print(f"✗ Failed to insert alert: {alert.get('title')}")
                    except Exception as e:
                        print(f"Error inserting alert: {e}")
                        import traceback
                        traceback.print_exc()
            else:
                print(f"Could not find patient ID for {email}")
        
        return {
            "has_alerts": analysis.get("has_alerts", False),
            "metrics": metrics,
            "alerts": analysis.get("alerts", []),
            "summary": analysis.get("summary", "")
        }
        
    except Exception as e:
        print(f"Error checking alerts for {email}: {e}")
        import traceback
        traceback.print_exc()
        return {
            "has_alerts": False,
            "metrics": [],
            "alerts": [],
            "summary": f"Error: {str(e)}"
        }


async def run_hourly_alert_check() -> None:
    print(f"\n{'='*50}")
    print(f"Running hourly alert check at {datetime.now(timezone.utc)}")
    print(f"{'='*50}")
    
    emails = await get_all_user_emails()
    print(f"Found {len(emails)} users to check")
    
    for email in emails:
        await process_alerts_for_user(email)
    
    print(f"Hourly alert check completed at {datetime.now(timezone.utc)}")
