import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SB_URL");
const SB_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
const FIREBASE_WEB_API_KEY = Deno.env.get("FIREBASE_WEB_API_KEY");

const BUCKET = "edusync-files";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-firebase-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    if (!SB_URL || !SB_SERVICE_ROLE_KEY || !FIREBASE_WEB_API_KEY) {
      return jsonResponse(
        {
          error: "Missing env vars",
          hasSBURL: !!SB_URL,
          hasServiceRole: !!SB_SERVICE_ROLE_KEY,
          hasFirebaseKey: !!FIREBASE_WEB_API_KEY,
        },
        500
      );
    }

    // Firebase token sent from app
    const firebaseToken = req.headers.get("x-firebase-token")?.trim();
    if (!firebaseToken) return jsonResponse({ error: "Missing x-firebase-token" }, 401);

    // Verify Firebase ID token
    const verifyResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: firebaseToken }),
      }
    );

    if (!verifyResp.ok) {
      const details = await verifyResp.text();
      return jsonResponse({ error: "Invalid Firebase token", details }, 401);
    }

    const supabase = createClient(SB_URL, SB_SERVICE_ROLE_KEY);

    // Read JSON body ONCE
    const body = await req.json().catch(() => ({} as any));

    // Decide action safely (no TDZ)
    const action = String(body?.action ?? "").toLowerCase();

    // ==========================
    //  A) SIGN (open private file)
    // ==========================
    if (action === "sign") {
      const filePath = String(body?.filePath ?? "");
      const expiresIn = Number(body?.expiresIn ?? 600); // default 10 minutes

      if (!filePath) return jsonResponse({ error: "Missing filePath" }, 400);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, expiresIn);

      if (error || !data?.signedUrl) {
        return jsonResponse({ error: error?.message ?? "Failed to sign URL" }, 500);
      }

      return jsonResponse({ signedUrl: data.signedUrl });
    }

    // =========================================
    //  B) UPLOAD (default if base64 is provided)
    // =========================================
    // If you don't send action, we treat it as upload (this fixes your current upload issue)
    const filePath = String(body?.filePath ?? "");
    const base64 = String(body?.base64 ?? "");
    const contentType = String(body?.contentType ?? "application/octet-stream");

    if (!filePath || !base64) {
      return jsonResponse(
        { error: "Missing filePath/base64. If opening, send action:'sign'." },
        400
      );
    }


    // Decode base64 -> bytes
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, bytes, { upsert: true, contentType });

    if (uploadError) return jsonResponse({ error: uploadError.message }, 500);

    return jsonResponse({ success: true, filePath });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
