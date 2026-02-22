from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from services.video_call import create_room, get_room_token
from utils.supabase_client import supabase, supabase_admin

router = APIRouter(prefix="/api/video", tags=["video_calls"])

@router.post("/initiate-call")
async def initiate_call(request: Request):
    try:
        body = await request.json()
        conversation_id = body.get("conversation_id")
        initiated_by = body.get("initiated_by")
        
        print(f"[VIDEO] ============================================")
        print(f"[VIDEO] Initiating call for conversation {conversation_id} by {initiated_by}")
        print(f"[VIDEO] ============================================")
        
        if not conversation_id or not initiated_by:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Missing conversation_id or initiated_by"}
            )
        
        room_response = await create_room(conversation_id, recording_enabled=False)
        print(f"[VIDEO] Room response: {room_response}")
        
        if not room_response.get("success"):
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": room_response.get("error")}
            )
        
        room_name = room_response.get("room_name")
        room_url = room_response.get("room_url")
        
        video_call_data = {
            "conversation_id": conversation_id,
            "provider": "daily",
            "room_name": room_name,
            "room_url": room_url,
            "started_by": initiated_by,
            "status": "ringing",
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("video_calls").insert(video_call_data).execute()
        print(f"[VIDEO] Supabase insert result: {result.data}")
        
        if not result.data:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Failed to create video call record"}
            )
        
        call_id = result.data[0]["id"]
        
        token_response = await get_room_token(room_name, initiated_by)
        print(f"[VIDEO] Token response: {token_response}")
        
        if not token_response.get("success"):
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Failed to generate token"}
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "call_id": call_id,
                "room_name": room_name,
                "room_url": room_url,
                "token": token_response.get("token")
            }
        )
    except Exception as e:
        print(f"[VIDEO] Error initiating call: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@router.post("/accept-call")
async def accept_call(request: Request):
    try:
        body = await request.json()
        call_id = body.get("call_id")
        accepted_by = body.get("accepted_by")
        
        print(f"[VIDEO] Accepting call {call_id} by {accepted_by}")
        
        if not call_id or not accepted_by:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Missing call_id or accepted_by"}
            )
        
        call = supabase.table("video_calls").select("*").eq("id", call_id).single().execute()
        
        if not call.data:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Call not found"}
            )
        
        supabase.table("video_calls").update({
            "status": "active",
            "started_at": datetime.utcnow().isoformat()
        }).eq("id", call_id).execute()
        
        token_response = await get_room_token(call.data["room_name"], accepted_by)
        
        if not token_response.get("success"):
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Failed to generate token"}
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "room_name": call.data["room_name"],
                "room_url": call.data["room_url"],
                "token": token_response.get("token")
            }
        )
    except Exception as e:
        print(f"[VIDEO] Error accepting call: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@router.post("/end-call")
async def end_call(request: Request):
    try:
        body = await request.json()
        call_id = body.get("call_id")
        
        print(f"[VIDEO] Ending call {call_id}")
        
        if not call_id:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Missing call_id"}
            )
        
        call = supabase.table("video_calls").select("*").eq("id", call_id).single().execute()
        
        if not call.data:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Call not found"}
            )
        
        supabase.table("video_calls").update({
            "status": "ended",
            "ended_at": datetime.utcnow().isoformat()
        }).eq("id", call_id).execute()
        
        return JSONResponse(
            status_code=200,
            content={"success": True}
        )
    except Exception as e:
        print(f"[VIDEO] Error ending call: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@router.post("/reject-call")
async def reject_call(request: Request):
    try:
        body = await request.json()
        call_id = body.get("call_id")
        
        print(f"[VIDEO] Rejecting call {call_id}")
        
        if not call_id:
            print(f"[VIDEO] No call_id provided, treating as emergency rejection")
            return JSONResponse(
                status_code=200,
                content={"success": True, "message": "Call rejected"}
            )
        
        call = supabase.table("video_calls").select("*").eq("id", call_id).single().execute()
        
        if not call.data:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Call not found"}
            )
        
        supabase.table("video_calls").update({
            "status": "missed"
        }).eq("id", call_id).execute()
        
        emergency_response = supabase_admin.table("emergencies").select("*").eq("video_call_id", str(call_id)).execute()
        
        if emergency_response.data and len(emergency_response.data) > 0:
            emergency = emergency_response.data[0]
            print(f"[VIDEO] Found associated emergency {emergency.get('id')}, resolving...")
            
            supabase_admin.table("emergencies").update({
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", emergency.get("id")).execute()
            
            print(f"[VIDEO] Emergency {emergency.get('id')} resolved due to call rejection")
        
        return JSONResponse(
            status_code=200,
            content={"success": True}
        )
    except Exception as e:
        print(f"[VIDEO] Error rejecting call: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
