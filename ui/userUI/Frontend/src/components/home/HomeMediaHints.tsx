"use client";

import ReactDOM from "react-dom";
import { SUPABASE_MEDIA_ORIGIN } from "@/lib/media";

/** Open the Storage connection before catalog image URLs arrive from the API. */
export function HomeMediaHints() {
  ReactDOM.preconnect(SUPABASE_MEDIA_ORIGIN, { crossOrigin: "anonymous" });
  ReactDOM.prefetchDNS(SUPABASE_MEDIA_ORIGIN);
  return null;
}
