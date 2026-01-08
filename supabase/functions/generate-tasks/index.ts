import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activityName, month, year, userId } = await req.json();

    if (!activityName || !userId) {
      return new Response(
        JSON.stringify({ error: "activityName and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `أنت مساعد ذكي متخصص في إدارة المشاريع والتخطيط. مهمتك هي توليد قائمة من المهام الفرعية المنبثقة من نشاط معين.

قواعد مهمة:
1. أنشئ من 3 إلى 7 مهام فرعية تفصيلية وعملية
2. كل مهمة يجب أن تكون واضحة وقابلة للتنفيذ
3. رتب المهام حسب الأولوية والتسلسل المنطقي
4. اجعل المهام متنوعة تغطي جوانب مختلفة من النشاط

يجب أن ترد باستخدام الأداة suggest_tasks فقط.`;

    const userPrompt = `النشاط الرئيسي: "${activityName}"
${month ? `الشهر: ${month}` : ''}
${year ? `السنة: ${year}` : ''}

قم بتوليد المهام الفرعية المنبثقة من هذا النشاط.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_tasks",
              description: "إرجاع قائمة من المهام الفرعية المقترحة",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "عنوان المهمة" },
                        description: { type: "string", description: "وصف تفصيلي للمهمة" },
                        priority: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "أولوية المهمة" 
                        },
                        category: { type: "string", description: "تصنيف المهمة" },
                      },
                      required: ["title", "description", "priority", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_tasks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول مرة أخرى لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("فشل في الاتصال بالذكاء الاصطناعي");
    }

    const data = await response.json();
    
    // استخراج المهام من tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "suggest_tasks") {
      throw new Error("لم يتم توليد المهام بشكل صحيح");
    }

    const generatedTasks = JSON.parse(toolCall.function.arguments);
    
    // إدراج المهام في قاعدة البيانات
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const tasksToInsert = generatedTasks.tasks.map((task: any) => ({
      title: task.title,
      description: task.description,
      user_id: userId,
      priority: task.priority,
      category: task.category,
      status: "pending",
      ai_generated: true,
      due_date: null,
    }));

    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("فشل في حفظ المهام");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasks: insertedTasks,
        message: `تم توليد ${insertedTasks.length} مهمة بنجاح`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-tasks error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
