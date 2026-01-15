import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { imageDataUrl, fileName } = await req.json();

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "صورة غير صالحة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic payload guard (data URLs can get big)
    if (imageDataUrl.length > 10_000_000) {
      return new Response(JSON.stringify({ error: "حجم الصورة كبير جداً لاستخراج النص" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `أنت نظام OCR متقدم. استخرج النص العربي والإنجليزي بدقة عالية من صورة صفحة PDF.

قواعد مهمة:
- أعِد النص فقط كما يظهر (لا تشرح).
- حافظ على الفواصل والأسطر قدر الإمكان.
- إذا كان هناك أرقام/معرّفات، لا تغيّرها.
- اكتب العربية من اليمين لليسار بشكل طبيعي.`;

    const userPrompt = `استخرج النص من هذه الصفحة.${fileName ? ` اسم الملف: ${fileName}` : ""}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: { url: imageDataUrl },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_text",
                description: "Extract OCR text from the provided page image.",
                parameters: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                  },
                  required: ["text"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_text" } },
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OCR AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "تعذر استخراج النص" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    let text = "";
    if (toolCall?.function?.name === "extract_text" && toolCall.function.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        text = String(parsed?.text || "");
      } catch (e) {
        console.error("Failed to parse OCR tool arguments", e);
      }
    }

    if (!text.trim()) {
      // Fallback to plain content if tool parsing fails.
      text = String(data?.choices?.[0]?.message?.content || "");
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ocr-document-text error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء استخراج النص",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
