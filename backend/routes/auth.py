from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.supabase_client import supabase

security = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        user = supabase.auth.get_user(token.credentials)
        if not user.user:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

async def get_user_profile(user_id: str):
    try:
        response = supabase.table('profiles').select('*').eq('id', user_id).single().execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=404, detail="Profile not found")
