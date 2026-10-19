from scripts.supabase_test_support import create_test_app, local_settings

local_settings()
from phub_api.config.database import supabase

app = create_test_app(supabase)
