import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const form = await req.formData();
    const file = form.get("file");
    const uid = form.get("uid")?.toString();

    if (!uid) throw new Error("Missing uid");
    if (!(file instanceof File)) throw new Error("Missing file");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}.${ext}`; 

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

   
    const expiresIn = 60 * 60 * 24 * 7; 
    const { data: signed, error: signErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, expiresIn);

    if (signErr) throw signErr;

    return new Response(
      JSON.stringify({
        path,                
        signedUrl: signed.signedUrl, 
        expiresIn,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? "Upload failed" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
