from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from utils.supabase_client import supabase, supabase_admin
import httpx
import os
from services.video_call import create_room, get_room_token


VITAL_THRESHOLDS = {
    "heart_rate": {"min": 40, "max": 130},
    "respiratory_rate": {"min": 8, "max": 30},
    "blood_oxygen_saturation": {"min": 90, "max": 100},
    "apple_sleeping_wrist_temperature": {"min": 35, "max": 38.5},
    "heart_rate_variability": {"min": 20, "max": None},
    "resting_heart_rate": {"min": 40, "max": 130},
}


def is_abnormal(metric_name: str, value: float) -> bool:
    """Check if a metric value is outside normal thresholds."""
    thresholds = VITAL_THRESHOLDS.get(metric_name)
    if not thresholds:
        return False
    
    min_val = thresholds.get("min")
    max_val = thresholds.get("max")
    
    if min_val is not None and value < min_val:
        return True
    if max_val is not None and value > max_val:
        return True
    
    return False


async def get_patient_id_from_email(email: str) -> Optional[str]:
    """Get patient UUID from email."""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))
        
        print(f"[GET_PATIENT_ID] Looking up: {email}")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key
                },
                params={"query": email}
            )
            print(f"[GET_PATIENT_ID] Response status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                print(f"[GET_PATIENT_ID] Found {len(users)} user(s)")
                for user in users:
                    if user.get("email") == email:
                        user_id = user.get("id")
                        print(f"[GET_PATIENT_ID] Matched user: {user_id}")
                        return user_id
        
        print(f"[GET_PATIENT_ID] No matching user found")
        return None
    except Exception as e:
        print(f"[GET_PATIENT_ID] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def get_active_conversation(patient_id: str) -> Optional[Dict[str, Any]]:
    """Get the active conversation for a patient (most recent)."""
    try:
        print(f"[GET_CONVERSATION] Looking for conversation for patient {patient_id}")
        response = supabase_admin.table("conversations").select("*").eq("patient_id", patient_id).order("created_at", desc=True).limit(1).execute()
        print(f"[GET_CONVERSATION] Response data: {response.data}")
        if response.data and len(response.data) > 0:
            conv = response.data[0]
            print(f"[GET_CONVERSATION] Found conversation: {conv.get('id')}")
            return conv
        print(f"[GET_CONVERSATION] No conversation found")
        return None
    except Exception as e:
        print(f"[GET_CONVERSATION] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def get_patient_doctor(patient_id: str) -> Optional[str]:
    """Get the active doctor for a patient."""
    try:
        print(f"[GET_DOCTOR] Looking for active doctor for patient {patient_id}")
        response = supabase_admin.table("patient_doctor_links").select("doctor_id").eq("patient_id", patient_id).eq("status", "active").single().execute()
        print(f"[GET_DOCTOR] Response data: {response.data}")
        doctor_id = response.data["doctor_id"] if response.data else None
        if doctor_id:
            print(f"[GET_DOCTOR] Found doctor: {doctor_id}")
        else:
            print(f"[GET_DOCTOR] No doctor found")
        return doctor_id
    except Exception as e:
        print(f"[GET_DOCTOR] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def send_emergency_notifications(
    patient_id: str,
    doctor_id: str,
    emergency_id: str,
    conversation_id: int,
    patient_email: str = "unknown"
) -> None:
    """Send emergency alerts to both patient and doctor."""
    try:
        print(f"[NOTIFICATIONS] Creating emergency alerts for patient and doctor...")
        print(f"[NOTIFICATIONS] Patient email: {patient_email}")
        
        doctor_profile = supabase_admin.table("profiles").select("full_name").eq("id", doctor_id).single().execute()
        doctor_name = doctor_profile.data.get("full_name", "Doctor") if doctor_profile.data else "Doctor"
        
        now = datetime.now(timezone.utc).isoformat()
        
        patient_alert_data = {
            "patient_id": patient_id,
            "patient_email": patient_email,
            "title": "🚨 Emergency Alert",
            "message": "Medical emergency detected. Your doctor will contact you shortly.",
            "alert_type": "health_metric",
            "severity": "critical",
            "status": "open",
            "emergency_id": emergency_id,
            "metadata": {
                "conversation_id": conversation_id,
                "type": "emergency_alert"
            },
            "created_at": now
        }
        
        doctor_alert_data = {
            "patient_id": doctor_id,
            "patient_email": patient_email,
            "title": "🚨 Emergency Alert - Patient Crisis",
            "message": f"Patient {patient_email} vitals triggered an emergency. Please call them immediately.",
            "alert_type": "health_metric",
            "severity": "critical",
            "status": "open",
            "emergency_id": emergency_id,
            "metadata": {
                "patient_id": patient_id,
                "patient_email": patient_email,
                "conversation_id": conversation_id,
                "type": "emergency_doctor_alert"
            },
            "created_at": now
        }
        
        patient_response = supabase_admin.table("alerts").insert(patient_alert_data).execute()
        print(f"[NOTIFICATIONS] Patient alert created: {patient_response.data[0].get('id') if patient_response.data else 'failed'}")
        
        doctor_response = supabase_admin.table("alerts").insert(doctor_alert_data).execute()
        print(f"[NOTIFICATIONS] Doctor alert created: {doctor_response.data[0].get('id') if doctor_response.data else 'failed'}")
        
        print(f"[NOTIFICATIONS] ✓ Emergency alerts sent")
        
    except Exception as e:
        print(f"[NOTIFICATIONS] ❌ Error sending alerts: {e}")
        import traceback
        traceback.print_exc()


async def check_existing_emergency(conversation_id: int) -> bool:
    """Check if there's already an active emergency for this conversation."""
    try:
        print(f"[CHECK_EMERGENCY] Checking for active emergency for conversation {conversation_id}")
        response = supabase_admin.table("emergencies").select("id").eq("conversation_id", conversation_id).eq("status", "active").execute()
        print(f"[CHECK_EMERGENCY] Response data: {response.data}")
        exists = len(response.data) > 0 if response.data else False
        print(f"[CHECK_EMERGENCY] Emergency exists: {exists}")
        return exists
    except Exception as e:
        print(f"[CHECK_EMERGENCY] Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def create_emergency(
    patient_id: str,
    doctor_id: str,
    conversation_id: int,
    patient_email: str = "unknown"
) -> Optional[Dict[str, Any]]:
    """Create an emergency record. Patient will initiate video call."""
    try:
        print(f"\n[EMERGENCY] ============================================")
        print(f"[EMERGENCY] Creating emergency for patient {patient_id}")
        print(f"[EMERGENCY] Conversation ID: {conversation_id}")
        print(f"[EMERGENCY] ============================================")
        
        emergency_data = {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "conversation_id": conversation_id,
            "video_call_id": None,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        print(f"[EMERGENCY] Creating emergency record: {emergency_data}")
        response = supabase_admin.table("emergencies").insert(emergency_data).execute()
        print(f"[EMERGENCY] Emergency insert response: {response.data}")
        
        if response.data and len(response.data) > 0:
            emergency = response.data[0]
            emergency_id = emergency.get('id')
            print(f"[EMERGENCY] ✓✓✓ EMERGENCY CREATED {emergency_id} FOR PATIENT {patient_id}")
            
            print(f"[EMERGENCY] Sending notifications to patient and doctor...")
            await send_emergency_notifications(
                patient_id=patient_id,
                doctor_id=doctor_id,
                emergency_id=emergency_id,
                conversation_id=conversation_id,
                patient_email=patient_email
            )
            
            print(f"[EMERGENCY] ============================================\n")
            return emergency
        
        print(f"[EMERGENCY] ❌ Failed to insert emergency record")
        return None
    except Exception as e:
        print(f"[EMERGENCY] ❌ Error creating emergency: {e}")
        import traceback
        traceback.print_exc()
        return None


async def check_vitals_and_trigger_emergency(email: str) -> Optional[Dict[str, Any]]:
    """Check the latest vital signs for abnormalities and trigger emergency if needed."""
    try:
        print(f"\n{'='*60}")
        print(f"[EMERGENCY_CHECK] Starting vital check for {email}")
        print(f"{'='*60}")
        
        now = datetime.now(timezone.utc)
        hour_start = now - timedelta(hours=1)
        print(f"[EMERGENCY_CHECK] Looking for vitals since: {hour_start.isoformat()}")
        
        patient_id = await get_patient_id_from_email(email)
        if not patient_id:
            print(f"[EMERGENCY_CHECK] ❌ Patient ID not found for {email}")
            return None
        
        print(f"[EMERGENCY_CHECK] ✓ Patient ID: {patient_id}")
        
        print(f"[EMERGENCY_CHECK] Fetching realtime vitals for {email}...")
        response_realtime = supabase_admin.table("health_realtime").select("*").eq("email", email).gte("timestamp", hour_start.isoformat()).execute()
        print(f"[EMERGENCY_CHECK] Realtime records found: {len(response_realtime.data) if response_realtime.data else 0}")
        if response_realtime.data:
            for r in response_realtime.data:
                print(f"  - {r.get('metric_name')}: {r.get('value')} at {r.get('timestamp')}")
        
        print(f"[EMERGENCY_CHECK] Fetching aggregated vitals for {email}...")
        response_aggregated = supabase_admin.table("health_aggregated").select("*").eq("email", email).gte("timestamp", hour_start.isoformat()).execute()
        print(f"[EMERGENCY_CHECK] Aggregated records found: {len(response_aggregated.data) if response_aggregated.data else 0}")
        if response_aggregated.data:
            for r in response_aggregated.data:
                print(f"  - {r.get('metric_name')}: {r.get('value')} at {r.get('timestamp')}")
        
        all_vitals = (response_realtime.data or []) + (response_aggregated.data or [])
        print(f"[EMERGENCY_CHECK] Total vital records: {len(all_vitals)}")
        
        if not all_vitals:
            print(f"[EMERGENCY_CHECK] ❌ No vital data found for {email}")
            return None
        
        abnormal_vitals = []
        for vital in all_vitals:
            metric_name = vital.get("metric_name")
            value = vital.get("value")
            
            if metric_name and value is not None:
                try:
                    value = float(value)
                    is_abn = is_abnormal(metric_name, value)
                    print(f"[EMERGENCY_CHECK] {metric_name}: {value} - abnormal: {is_abn}")
                    if is_abn:
                        abnormal_vitals.append({
                            "metric": metric_name,
                            "value": value,
                            "timestamp": vital.get("timestamp")
                        })
                except (ValueError, TypeError) as e:
                    print(f"[EMERGENCY_CHECK] Error parsing {metric_name}: {e}")
        
        if not abnormal_vitals:
            print(f"[EMERGENCY_CHECK] ❌ No abnormal vitals for {email}")
            return None
        
        print(f"[EMERGENCY_CHECK] ✓ Found {len(abnormal_vitals)} abnormal vital(s)")
        import sys
        sys.stdout.flush()
        
        print(f"[EMERGENCY_CHECK] Fetching active conversation for patient {patient_id}...")
        conversation = await get_active_conversation(patient_id)
        if not conversation:
            print(f"[EMERGENCY_CHECK] ❌ No active conversation found for patient {patient_id}")
            return None
        
        conversation_id = conversation.get("id")
        print(f"[EMERGENCY_CHECK] ✓ Conversation ID: {conversation_id}")
        
        print(f"[EMERGENCY_CHECK] Checking for existing active emergency...")
        existing_emergency = await check_existing_emergency(conversation_id)
        if existing_emergency:
            print(f"[EMERGENCY_CHECK] ❌ Active emergency already exists for conversation {conversation_id}")
            return None
        print(f"[EMERGENCY_CHECK] ✓ No existing active emergency")
        
        print(f"[EMERGENCY_CHECK] Fetching active doctor for patient {patient_id}...")
        doctor_id = await get_patient_doctor(patient_id)
        if not doctor_id:
            print(f"[EMERGENCY_CHECK] ❌ No active doctor found for patient {patient_id}")
            return None
        
        print(f"[EMERGENCY_CHECK] ✓ Doctor ID: {doctor_id}")
        
        print(f"[EMERGENCY_CHECK] Creating emergency record...")
        emergency = await create_emergency(
            patient_id=patient_id,
            doctor_id=doctor_id,
            conversation_id=conversation_id,
            patient_email=email
        )
        
        if emergency:
            print(f"[EMERGENCY_CHECK] ✓✓✓ EMERGENCY CREATED ✓✓✓")
            return {
                "emergency_id": emergency.get("id"),
                "status": "triggered",
                "abnormal_vitals": abnormal_vitals,
                "message": f"Emergency triggered for {email} with {len(abnormal_vitals)} abnormal vital(s)"
            }
        
        print(f"[EMERGENCY_CHECK] ❌ Failed to create emergency")
        return None
        
    except Exception as e:
        print(f"[EMERGENCY_CHECK] ❌ Error checking vitals: {e}")
        import traceback
        traceback.print_exc()
        return None
