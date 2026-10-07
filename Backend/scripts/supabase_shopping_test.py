"""Entrypoint for the approved first-customer test on real Supabase, local only.

Production/Render must keep app.main:app; never point it at this module.
"""
from scripts.supabase_test_support import create_test_app, local_settings

local_settings()
from app.supabase import supabase  # noqa: E402 — credentials loaded only after the local guard

app = create_test_app(supabase)
