import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { month, year } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // جلب الخطط التنفيذية للشهر المحدد مع user_id من الخطة التشغيلية
    const targetMonth = month || 1;
    const { data: executivePlans, error: fetchError } = await supabase
      .from("executive_plans")
      .select(`
        id,
        day,
        daily_target,
        status,
        operational_plan_months!inner (
          month,
          operational_plans!inner (
            activity_name,
            initiative,
            strategic_goal,
            user_id
          )
        )
      `)
      .eq("operational_plan_months.month", targetMonth);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw new Error("فشل في جلب الخطط التنفيذية");
    }

    if (!executivePlans || executivePlans.length === 0) {
      return new Response(
        JSON.stringify({ error: "لا توجد خطط تنفيذية لهذا الشهر" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // تجميع الخطط حسب النشاط مع حفظ user_id
    const activitiesMap = new Map<string, { 
      activityName: string; 
      initiative: string | null;
      userId: string;
      days: { id: string; day: number; dailyTarget: number }[];
    }>();

    executivePlans.forEach((ep: any) => {
      const activityName = ep.operational_plan_months.operational_plans.activity_name;
      const initiative = ep.operational_plan_months.operational_plans.initiative;
      const userId = ep.operational_plan_months.operational_plans.user_id;
      
      if (!activitiesMap.has(activityName)) {
        activitiesMap.set(activityName, {
          activityName,
          initiative,
          userId,
          days: []
        });
      }
      
      activitiesMap.get(activityName)!.days.push({
        id: ep.id,
        day: ep.day,
        dailyTarget: ep.daily_target
      });
    });

    const allTasks: any[] = [];
    const monthName = MONTHS_AR[targetMonth - 1];
    const MAX_TASKS_PER_DAY_PER_USER = 15; // الحد الأقصى للمهام لكل يوم لكل موظف

    // توليد مهام لكل نشاط
    for (const [activityName, activityData] of activitiesMap) {
      // حساب عدد الأيام لتحديد عدد المهام لكل نشاط
      const daysCount = activityData.days.length;
      // نحدد عدد المهام لكل نشاط بحيث لا تتجاوز المجموع الكلي الحد الأقصى
      const maxTasksForActivity = Math.min(6, Math.ceil(MAX_TASKS_PER_DAY_PER_USER / Math.max(activitiesMap.size, 1)));
      
      const systemPrompt = `أنت مساعد ذكي متخصص في إدارة المشاريع والتخطيط في المؤسسات. مهمتك هي توليد مهام فرعية تفصيلية منبثقة من النشاط الرئيسي.

قواعد مهمة:
1. أنشئ من 2 إلى ${maxTasksForActivity} مهام فرعية تفصيلية وعملية فقط
2. كل مهمة يجب أن تكون واضحة، محددة، وقابلة للتنفيذ
3. المهام يجب أن تكون متنوعة وتغطي جوانب مختلفة من النشاط
4. اجعل المهام مرتبطة بالسياق المؤسسي والإداري
5. حدد الأولوية بناءً على أهمية المهمة

يجب أن ترد باستخدام الأداة suggest_tasks فقط.`;

      const daysInfo = activityData.days
        .sort((a, b) => a.day - b.day)
        .map(d => `يوم ${d.day}: الهدف اليومي ${d.dailyTarget}`)
        .join("\n");

      const userPrompt = `النشاط الرئيسي: "${activityName}"
${activityData.initiative ? `المبادرة: ${activityData.initiative}` : ''}
الشهر: ${monthName} ${year || new Date().getFullYear()}

الأيام المحددة للتنفيذ:
${daysInfo}

قم بتوليد مهام فرعية تفصيلية لهذا النشاط. اجعل المهام عملية وقابلة للتطبيق في بيئة العمل المؤسسي.`;

      try {
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
                            day: { type: "number", description: "اليوم المحدد للتنفيذ" },
                          },
                          required: ["title", "description", "priority", "category", "day"],
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
            console.error("Rate limit for activity:", activityName);
            continue;
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          continue;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall && toolCall.function.name === "suggest_tasks") {
          const generatedTasks = JSON.parse(toolCall.function.arguments);
          
          // ربط المهام بالخطة التنفيذية المناسبة واستخدام user_id من الخطة التشغيلية
          for (const task of generatedTasks.tasks) {
            const matchingDay = activityData.days.find(d => d.day === task.day) || activityData.days[0];
            
            allTasks.push({
              title: task.title,
              description: task.description,
              user_id: activityData.userId, // استخدام user_id من الخطة التشغيلية
              executive_plan_id: matchingDay.id,
              priority: task.priority,
              category: task.category || activityName,
              status: "pending",
              ai_generated: true,
              due_date: `${year || new Date().getFullYear()}-${String(targetMonth).padStart(2, '0')}-${String(task.day || matchingDay.day).padStart(2, '0')}`,
            });
          }
        }
      } catch (aiError) {
        console.error("AI error for activity:", activityName, aiError);
        continue;
      }

      // تأخير بسيط لتجنب rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (allTasks.length === 0) {
      return new Response(
        JSON.stringify({ error: "لم يتم توليد أي مهام" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // تطبيق الحد الأقصى: 15 مهمة لكل يوم لكل موظف
    const tasksPerUserPerDay = new Map<string, any[]>();
    
    for (const task of allTasks) {
      const key = `${task.user_id}_${task.due_date}`;
      if (!tasksPerUserPerDay.has(key)) {
        tasksPerUserPerDay.set(key, []);
      }
      const dayTasks = tasksPerUserPerDay.get(key)!;
      if (dayTasks.length < MAX_TASKS_PER_DAY_PER_USER) {
        dayTasks.push(task);
      }
    }

    // تجميع المهام المصفاة
    const filteredTasks: any[] = [];
    for (const tasks of tasksPerUserPerDay.values()) {
      filteredTasks.push(...tasks);
    }

    if (filteredTasks.length === 0) {
      return new Response(
        JSON.stringify({ error: "لم يتم توليد أي مهام" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // جمع جميع user_ids الفريدة
    const uniqueUserIds = [...new Set(filteredTasks.map(t => t.user_id))];
    
    // حذف المهام المولدة سابقاً للشهر نفسه لكل مستخدم
    const startDate = `${year || new Date().getFullYear()}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = `${year || new Date().getFullYear()}-${String(targetMonth).padStart(2, '0')}-31`;
    
    for (const uid of uniqueUserIds) {
      await supabase
        .from("tasks")
        .delete()
        .eq("user_id", uid)
        .eq("ai_generated", true)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
    }

    // إدراج المهام الجديدة
    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(filteredTasks)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("فشل في حفظ المهام");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasks: insertedTasks,
        message: `تم توليد ${insertedTasks.length} مهمة لشهر ${monthName} بنجاح`,
        activitiesProcessed: activitiesMap.size
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