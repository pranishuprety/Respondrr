import os
import httpx
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
from supabase_client import supabase

HEALTH_API_BASE = os.getenv("HEALTH_API_BASE", "http://127.0.0.1:9876/api")
HEALTH_API_TOKEN = os.getenv("HEALTH_API_TOKEN")

class HealthSample(BaseModel):
    value: float
    timestamp: datetime
    units: Optional[str] = None
    source: Optional[str] = None

async def fetch_metric(endpoint: str, params: dict, units: Optional[str] = None) -> List[dict]:
    try:
        headers = {}
        if HEALTH_API_TOKEN:
            headers["Authorization"] = f"Bearer {HEALTH_API_TOKEN}"
            
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{HEALTH_API_BASE}{endpoint}", params=params, headers=headers)
            if response.status_code == 200:
                data = response.json()
                # Assuming the response is a list of samples or an object with a 'data' field
                samples = data if isinstance(data, list) else data.get("data", [])
                return samples
            else:
                print(f"Failed to fetch metric from {endpoint}: {response.status_code}")
                return []
    except Exception as e:
        print(f"Error fetching metric from {endpoint}: {e}")
        return []

def normalize_sample(sample: dict, units: Optional[str] = None) -> Optional[dict]:
    try:
        # Extract value
        value = None
        if "qty" in sample:
            value = sample["qty"]
        elif "Avg" in sample:
            value = sample["Avg"]
        elif "value" in sample:
            value = sample["value"]
        
        if value is None:
            return None

        # Extract timestamp
        timestamp = None
        if "date" in sample:
            timestamp = sample["date"]
        elif "timestamp" in sample:
            timestamp = sample["timestamp"]
        
        if not timestamp:
            return None

        return {
            "timestamp": timestamp,
            "value": float(value),
            "units": units,
            "source": sample.get("source")
        }
    except Exception as e:
        print(f"Error normalizing sample: {e}")
        return None

async def insert_realtime_data(email: str, metric_name: str, samples: List[dict]):
    if not samples:
        return 0
    
    rows = []
    for s in samples:
        normalized = normalize_sample(s)
        if normalized:
            rows.append({
                "email": email,
                "metric_name": metric_name,
                "timestamp": normalized["timestamp"],
                "value": normalized["value"],
                "source": normalized["source"]
            })
    
    if not rows:
        return 0

    try:
        # Switching to plain insert to avoid ON CONFLICT errors
        response = supabase.table("health_realtime").insert(rows).execute()
        return len(response.data)
    except Exception as e:
        print(f"Error inserting realtime data: {e}")
        return 0

async def insert_aggregated_data(email: str, metric_name: str, samples: List[dict], units: Optional[str] = None):
    if not samples:
        return 0
    
    rows = []
    for s in samples:
        normalized = normalize_sample(s, units)
        if normalized:
            rows.append({
                "email": email,
                "metric_name": metric_name,
                "timestamp": normalized["timestamp"],
                "value": normalized["value"],
                "units": normalized["units"]
            })
    
    if not rows:
        return 0

    try:
        # Switching to plain insert to avoid ON CONFLICT errors
        response = supabase.table("health_aggregated").insert(rows).execute()
        return len(response.data)
    except Exception as e:
        print(f"Error inserting aggregated data: {e}")
        return 0

def normalize_sleep_sample(sample: dict) -> Optional[dict]:
    try:
        return {
            "record_date": sample.get("date").split("T")[0] if "date" in sample else None,
            "sleep_start": sample.get("sleepStart") or sample.get("sleep_start"),
            "sleep_end": sample.get("sleepEnd") or sample.get("sleep_end"),
            "in_bed_start": sample.get("inBedStart") or sample.get("in_bed_start"),
            "in_bed_end": sample.get("inBedEnd") or sample.get("in_bed_end"),
            "deep": float(sample.get("deep", 0)),
            "core": float(sample.get("core", 0)),
            "rem": float(sample.get("rem", 0)),
            "awake": float(sample.get("awake", 0)),
            "total_sleep": float(sample.get("totalSleep", 0)),
            "source": sample.get("source")
        }
    except Exception as e:
        print(f"Error normalizing sleep sample: {e}")
        return None

async def upsert_sleep_data(email: str, samples: List[dict]):
    if not samples:
        return 0
    
    rows = []
    for s in samples:
        normalized = normalize_sleep_sample(s)
        if normalized:
            normalized["email"] = email
            rows.append(normalized)
    
    if not rows:
        return 0

    try:
        response = supabase.table("sleep_analysis").insert(rows).execute()
        return len(response.data)
    except Exception as e:
        # Fallback if table doesn't exist or constraint is different
        print(f"Error inserting sleep data: {e}")
        return 0
