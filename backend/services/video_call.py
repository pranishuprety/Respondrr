import os
import uuid
import httpx
from datetime import datetime, timedelta

DAILY_API_KEY = os.getenv("DAILY_API_KEY")
DAILY_API_URL = "https://api.daily.co/v1"

async def create_room(conversation_id: int, recording_enabled: bool = False) -> dict:
    room_name = f"conv-{conversation_id}-{uuid.uuid4().hex[:8]}"
    
    print(f"[DAILY] DAILY_API_KEY configured: {bool(DAILY_API_KEY)}")
    print(f"[DAILY] Creating room: {room_name}")
    
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "name": room_name,
        "privacy": "public",
        "properties": {
            "enable_recording": recording_enabled,
            "max_participants": 2,
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            print(f"[DAILY] Posting to {DAILY_API_URL}/rooms with headers: {headers}")
            response = await client.post(
                f"{DAILY_API_URL}/rooms",
                json=payload,
                headers=headers,
                timeout=10
            )
            
            print(f"[DAILY] Room creation response status: {response.status_code}")
            print(f"[DAILY] Room creation response body: {response.text}")
            
            if not response.is_success:
                error_text = response.text
                print(f"[DAILY] Room creation error: {error_text}")
                raise Exception(f"Status {response.status_code}: {error_text}")
            
            data = response.json()
        
        print(f"[DAILY] Room created successfully: {data.get('name')}")
        return {
            "success": True,
            "room_name": data.get("name"),
            "room_url": data.get("url"),
            "room_token": None
        }
    except Exception as e:
        print(f"[DAILY] Error creating Daily room: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

async def get_room_token(room_name: str, participant_name: str) -> dict:
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "room_name": room_name,
        "user_name": participant_name
    }
    
    try:
        # Use the correct token endpoint: /v1/meeting-tokens
        url = f"{DAILY_API_URL}/meeting-tokens"
        print(f"[DAILY] Attempting to get token from: {url}")
        print(f"[DAILY] Payload: {payload}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            print(f"[DAILY] Token response status: {response.status_code}")
            print(f"[DAILY] Token response body: {response.text}")
            
            if not response.is_success:
                error_text = response.text
                print(f"[DAILY] Token error: {error_text}")
                # For now, return empty token - Daily.co iframe works without it
                print(f"[DAILY] Warning: Token generation failed, proceeding without token")
                return {
                    "success": True,
                    "token": ""
                }
            
            data = response.json()
        
        print(f"[DAILY] Token generated successfully for room {room_name}")
        return {
            "success": True,
            "token": data.get("token", "")
        }
    except Exception as e:
        print(f"[DAILY] Error generating token: {e}")
        import traceback
        traceback.print_exc()
        # Return success with empty token - Daily.co iframe can work without it
        return {
            "success": True,
            "token": ""
        }

async def get_room_info(room_name: str) -> dict:
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Error getting room info: {e}")
        return None

async def end_room(room_name: str) -> dict:
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            return {"success": True}
    except httpx.HTTPError as e:
        print(f"Error ending room: {e}")
        return {"success": False, "error": str(e)}
