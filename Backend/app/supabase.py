import os

from dotenv import load_dotenv
from supabase import Client, create_client

from .config import ENV_FILE, ensure_env_file


env_created = ensure_env_file()
load_dotenv(dotenv_path=ENV_FILE)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SECRET_KEY")

placeholder_values = {
    "https://your-project.supabase.co",
    "sb_secret_xxxxxxxxx",
}

if not url or not key or url in placeholder_values or key in placeholder_values:
    if env_created:
        message = (
            f"Đã tự tạo {ENV_FILE} từ .env.example. "
            "Hãy điền SUPABASE_URL và SUPABASE_SECRET_KEY thật rồi khởi động lại."
        )
    else:
        message = (
            "Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY hợp lệ trong file .env"
        )
    raise RuntimeError(
        message
    )

supabase: Client = create_client(url, key)
