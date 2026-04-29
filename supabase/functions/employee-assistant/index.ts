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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
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

    // ──────────────────────────────────────────────────────────────
    // Routing مبسّط: استخدام Claude مباشرة عبر Anthropic API
    //   • Sonnet 4.5  → الافتراضي (ممتاز للبرمجة والتحليل والعربية)
    //   • Haiku       → للمحادثات القصيرة جداً (توفير التكلفة)
    // ──────────────────────────────────────────────────────────────
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: any) => m?.role === "user")?.content ?? "";
    const text = String(lastUserMsg);

    // استخدم Haiku للرسائل القصيرة جداً (تحية/سؤال بسيط) لتوفير التكلفة
    const isShortChat = text.length < 60;
    const selectedModel = isShortChat
      ? "claude-haiku-4-5"
      : "claude-sonnet-4-5";
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

    // تحويل رسائل OpenAI-style إلى Anthropic-style
    // (Anthropic لا يقبل دور system داخل messages، يجب فصله)
    const anthropicMessages = messages
      .filter((m: any) => m?.role === "user" || m?.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
      }));

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 2048,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!anthropicResp.ok) {
      if (anthropicResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الاستخدام، حاول بعد دقيقة." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (anthropicResp.status === 401) {
        return new Response(
          JSON.stringify({ error: "مفتاح Anthropic غير صحيح أو منتهي." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (anthropicResp.status === 402 || anthropicResp.status === 403) {
        return new Response(
          JSON.stringify({ error: "نفذ رصيد Anthropic، يرجى الشحن." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await anthropicResp.text();
      console.error("Anthropic error:", anthropicResp.status, t);
      return new Response(JSON.stringify({ error: "Anthropic API error" }), {
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