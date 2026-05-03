import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationId } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // استخدام بوابة الذكاء المدمجة لضمان الاتصال بدون مفاتيح خارجية.
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: any) => m?.role === "user")?.content ?? "";
    const text = String(lastUserMsg);

    // استخدم Haiku للرسائل القصيرة جداً (تحية/سؤال بسيط) لتوفير التكلفة
    const isShortChat = text.length < 60;
    const selectedModel = isShortChat
      ? "google/gemini-2.5-flash-lite"
      : "google/gemini-2.5-flash";
    const routedReason = isShortChat ? "short_chat" : "default_sonnet";

    // Pull a small employee context for the system prompt
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name, job_role, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const systemPrompt = `أنت "المساعد الذكي" الشخصي للموظف داخل منصة إدارة الجمعيات.
اسم الموظف: ${emp?.full_name ?? "غير محدد"}
الوظيفة: ${emp?.job_role ?? "غير محددة"}

مهمتك:
- مساعدته في تنظيم مهامه وتحسين أدائه.
- اقتراح أفكار إبداعية ومأتمتة لعمله.
- شرح كيفية استخدام الذكاء الاصطناعي بذكاء في مهامه اليومية.
- الإجابة بالعربية الفصحى المبسطة، بأسلوب ودود ومحترف، وبتنسيق Markdown واضح.`;

    // Log this conversation as AI usage (best-effort)
    try {
      await supabase.from("employee_ai_usage_logs").insert({
        user_id: user.id,
        organization_id: emp?.organization_id ?? null,
        feature: "assistant_chat",
        context: {
          conversation_id: conversationId ?? null,
          model: selectedModel,
          routed_reason: routedReason,
        },
      });
    } catch (_) { /* ignore */ }

    const chatMessages = messages
      .filter((m: any) => m?.role === "user" || m?.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
      }));

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الاستخدام، حاول بعد دقيقة." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402 || aiResp.status === 403) {
        return new Response(
          JSON.stringify({ error: "نفذ رصيد الذكاء الاصطناعي." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // تحويل Anthropic SSE إلى OpenAI-compatible SSE حتى يعمل الـ frontend الحالي بدون تغيير
    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResp.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const emit = (delta: string) => {
          const chunk = {
            choices: [{ delta: { content: delta }, index: 0, finish_reason: null }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;

              const payload = line.slice(6).trim();
              if (!payload) continue;

              try {
                const evt = JSON.parse(payload);
                if (
                  evt.type === "content_block_delta" &&
                  evt.delta?.type === "text_delta" &&
                  typeof evt.delta?.text === "string"
                ) {
                  emit(evt.delta.text);
                } else if (evt.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch (_) {
                /* skip malformed chunk */
              }
            }
          }
          controller.close();
        } catch (err) {
          console.error("stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});