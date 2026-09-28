import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { authorizationErrorResponse, requireTrustedCaller } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireTrustedCaller(req);
    const { text, voice_id = "JBFqnCBsd6RMkjVDRZzb" } = await req.json();
    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) return new Response("missing key", { status: 500 });
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.0 },
        }),
      }
    );
    if (!r.ok) return new Response(await r.text(), { status: r.status, headers: corsHeaders });
    const buf = await r.arrayBuffer();
    return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
  } catch (e) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});