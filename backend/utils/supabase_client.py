import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
service_key: str = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(url, key)
supabase_admin: Client = create_client(url, service_key) if service_key else supabase
