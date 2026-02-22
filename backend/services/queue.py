from datetime import datetime, timezone
from utils.supabase_client import supabase_admin
from services.emergency import check_vitals_and_trigger_emergency
from typing import List, Dict, Any


async def get_pending_emergency_checks(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetch pending emergency check jobs from the queue."""
    try:
        response = supabase_admin.table("emergency_check_queue").select("*").eq("status", "pending").limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"[QUEUE] Error fetching pending jobs: {e}")
        return []


async def update_job_status(job_id: int, status: str, error_message: str = None) -> bool:
    """Update the status of a queue job."""
    try:
        update_data = {
            "status": status,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }
        if error_message:
            update_data["error_message"] = error_message
        
        supabase_admin.table("emergency_check_queue").update(update_data).eq("id", job_id).execute()
        return True
    except Exception as e:
        print(f"[QUEUE] Error updating job {job_id}: {e}")
        return False


async def process_emergency_check_queue() -> None:
    """Process all pending emergency check jobs."""
    try:
        print(f"\n[QUEUE] Starting emergency check queue processing...")
        
        pending_jobs = await get_pending_emergency_checks()
        
        if not pending_jobs:
            print(f"[QUEUE] No pending jobs")
            return
        
        print(f"[QUEUE] Found {len(pending_jobs)} pending job(s)")
        
        for job in pending_jobs:
            job_id = job.get("id")
            email = job.get("email")
            metric_source = job.get("metric_source")
            
            print(f"\n[QUEUE] Processing job {job_id}: email={email}, source={metric_source}")
            
            try:
                await update_job_status(job_id, "processing")
                
                result = await check_vitals_and_trigger_emergency(email)
                
                if result:
                    print(f"[QUEUE] ✓ Job {job_id} completed - emergency triggered")
                    await update_job_status(job_id, "completed")
                else:
                    print(f"[QUEUE] ✓ Job {job_id} completed - no emergency needed")
                    await update_job_status(job_id, "completed")
                    
            except Exception as e:
                error_msg = str(e)
                print(f"[QUEUE] ✗ Job {job_id} failed: {error_msg}")
                await update_job_status(job_id, "failed", error_msg)
        
        print(f"[QUEUE] Queue processing completed\n")
        
    except Exception as e:
        print(f"[QUEUE] Error in queue processing: {e}")
        import traceback
        traceback.print_exc()
