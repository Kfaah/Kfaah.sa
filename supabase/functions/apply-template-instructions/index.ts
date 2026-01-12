import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instruction, currentTemplate } = await req.json();

    const systemPrompt = `أنت مساعد ذكي متخصص في إنشاء وتعديل نماذج طلبات الموارد البشرية.
    
مهمتك هي تحليل التعليمات المقدمة وتطبيقها على النموذج الحالي.

النموذج الحالي:
${JSON.stringify(currentTemplate, null, 2)}

قواعد مهمة:
1. يجب أن ترجع JSON فقط بدون أي نص إضافي
2. يجب أن تحافظ على البنية الأساسية للنموذج
3. عند إضافة حقل مخصص، استخدم هذه البنية:
   { "id": "uuid", "name": "field_name", "label": "اسم الحقل", "type": "text|textarea|date|select|file|number|checkbox", "required": true/false, "options": ["خيار1", "خيار2"] }
4. عند إضافة مرحلة موافقة، استخدم هذه البنية:
   { "id": "uuid", "order": 1, "name": "اسم المرحلة", "approverRole": "admin|moderator|specific_user", "isRequired": true, "canReject": true }
5. المتغيرات المتاحة للقالب: {اسم_الموظف} {المسمى_الوظيفي} {نوع_الطلب} {تاريخ_البداية} {تاريخ_النهاية} {عدد_الأيام}

أرجع فقط الحقول التي تم تعديلها أو إضافتها كـ JSON.`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `التعليمات: ${instruction}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API Error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let updates: Record<string, any> = {};
    
    if (jsonMatch) {
      try {
        updates = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        updates = {};
      }
    }

    // Generate UUIDs for new fields and stages
    if (updates.custom_fields && Array.isArray(updates.custom_fields)) {
      updates.custom_fields = updates.custom_fields.map((field: any) => ({
        ...field,
        id: field.id || crypto.randomUUID(),
      }));
    }
    
    if (updates.workflow_stages && Array.isArray(updates.workflow_stages)) {
      updates.workflow_stages = updates.workflow_stages.map((stage: any, index: number) => ({
        ...stage,
        id: stage.id || crypto.randomUUID(),
        order: stage.order || index + 1,
      }));
    }

    return new Response(JSON.stringify(updates), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in apply-template-instructions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
