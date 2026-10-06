import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SECRET_KEY")

if not url or not key:
    raise RuntimeError(
        "Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong file .env"
    )

supabase: Client = create_client(url, key)