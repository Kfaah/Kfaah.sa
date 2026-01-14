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
    const { month, months, year, userIds } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // دعم الأشهر المتعددة أو شهر واحد
    let targetMonths: number[] = [];
    if (months && Array.isArray(months) && months.length > 0) {
      targetMonths = months;
    } else if (month) {
      targetMonths = [month];
    } else {
      targetMonths = [new Date().getMonth() + 1];
    }
    
    const targetYear = year || new Date().getFullYear();
    
    let totalPlansGenerated = 0;
    let totalTasksGenerated = 0;
    let totalActivitiesProcessed = 0;
    const processedMonths: string[] = [];

    // معالجة كل شهر على حدة
    for (const targetMonth of targetMonths) {
      // جلب الخطط التشغيلية مع أشهرها
      let query = supabase
        .from("operational_plans")
        .select(`
          id,
          activity_name,
          annual_target,
          initiative,
          strategic_goal,
          user_id,
          responsible_employee_id,
          operational_plan_months!inner (
            id,
            month,
            monthly_target
          )
        `)
        .eq("year", targetYear)
        .eq("operational_plan_months.month", targetMonth);

      // تصفية حسب الموظفين المحددين
      if (userIds && userIds.length > 0) {
        query = query.in("user_id", userIds);
      }

      const { data: operationalPlans, error: fetchError } = await query;

      if (fetchError) {
        console.error(`Fetch error for month ${targetMonth}:`, fetchError);
        continue; // تجاوز الشهر والمتابعة
      }

      if (!operationalPlans || operationalPlans.length === 0) {
        console.log(`No operational plans for month ${targetMonth}`);
        continue;
      }

      // جلب أسماء الموظفين
      const allUserIds = [...new Set(operationalPlans.map(p => p.user_id))];
      const { data: employees } = await supabase
        .from("employees")
        .select("id, full_name, user_id, job_role, department_id")
        .in("user_id", allUserIds);

      const employeeMap = new Map(employees?.map(e => [e.user_id, e]) || []);

      // تجهيز البيانات للذكاء الاصطناعي
      const plansData = operationalPlans.map((plan: any) => {
        const planMonth = plan.operational_plan_months[0];
        const employee = employeeMap.get(plan.user_id);
        return {
          planId: plan.id,
          planMonthId: planMonth.id,
          activityName: plan.activity_name,
          initiative: plan.initiative,
          strategicGoal: plan.strategic_goal,
          monthlyTarget: planMonth.monthly_target,
          annualTarget: plan.annual_target,
          userId: plan.user_id,
          employeeName: employee?.full_name || "موظف",
          jobRole: employee?.job_role || "",
        };
      });

      const monthName = MONTHS_AR[targetMonth - 1];
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      // توليد الخطط التنفيذية باستخدام الذكاء الاصطناعي
      const systemPrompt = `أنت مستشار تخطيط استراتيجي متخصص في توزيع المستهدفات على أيام العمل.
      
مهمتك: توزيع المستهدف الشهري على أيام العمل بشكل ذكي ومتوازن.

قواعد التوزيع:
1. تجنب أيام الجمعة والسبت (عطلة نهاية الأسبوع)
2. وزّع المستهدف بشكل متساوي قدر الإمكان
3. إذا كان المستهدف صغير (1-4)، اختر أيام متفرقة
4. إذا كان المستهدف كبير، وزّعه على معظم أيام العمل
5. اختر عدد الأيام المناسب بناءً على حجم المستهدف
6. تأكد أن مجموع المستهدفات اليومية يساوي المستهدف الشهري

يجب أن ترد باستخدام الأداة distribute_targets فقط.`;

      const userPrompt = `الشهر: ${monthName} ${targetYear}
عدد أيام الشهر: ${daysInMonth}

الخطط التشغيلية المطلوب توزيعها:
${plansData.map((p, i) => `
${i + 1}. النشاط: ${p.activityName}
   المبادرة: ${p.initiative || "غير محدد"}
   المستهدف الشهري: ${p.monthlyTarget}
   الموظف: ${p.employeeName} (${p.jobRole})
`).join("\n")}

قم بتوزيع المستهدف الشهري لكل نشاط على أيام العمل المناسبة في الشهر.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "distribute_targets",
                description: "توزيع المستهدفات الشهرية على الأيام",
                parameters: {
                  type: "object",
                  properties: {
                    distributions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          activityIndex: { 
                            type: "number", 
                            description: "رقم النشاط (يبدأ من 0)" 
                          },
                          days: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                day: { type: "number", description: "رقم اليوم في الشهر" },
                                target: { type: "number", description: "المستهدف لهذا اليوم" },
                              },
                              required: ["day", "target"],
                            },
                          },
                        },
                        required: ["activityIndex", "days"],
                      },
                    },
                  },
                  required: ["distributions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "distribute_targets" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }),
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
        console.error(`AI error for month ${targetMonth}:`, errorText);
        continue;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.function.name !== "distribute_targets") {
        console.error(`Invalid AI response for month ${targetMonth}`);
        continue;
      }

      const distributions = JSON.parse(toolCall.function.arguments);
      const executivePlansToInsert: any[] = [];
      const planMetadata: { planMonthId: string; day: number; activityName: string; userId: string; dailyTarget: number }[] = [];

      // تحويل التوزيعات إلى خطط تنفيذية
      for (const dist of distributions.distributions) {
        const planData = plansData[dist.activityIndex];
        if (!planData) continue;

        for (const dayData of dist.days) {
          executivePlansToInsert.push({
            operational_plan_month_id: planData.planMonthId,
            day: dayData.day,
            daily_target: dayData.target,
            achieved: 0,
            status: "pending",
            notes: `تم التوليد بالذكاء الاصطناعي - ${planData.activityName}`,
          });
          
          planMetadata.push({
            planMonthId: planData.planMonthId,
            day: dayData.day,
            activityName: planData.activityName,
            userId: planData.userId,
            dailyTarget: dayData.target,
          });
        }
      }

      if (executivePlansToInsert.length === 0) {
        console.log(`No plans generated for month ${targetMonth}`);
        continue;
      }

      // حذف الخطط التنفيذية القديمة للشهر نفسه
      const planMonthIds = [...new Set(executivePlansToInsert.map(p => p.operational_plan_month_id))];
      
      // أولاً: جلب الخطط التنفيذية القديمة لحذف المهام المرتبطة بها
      const { data: oldExecutivePlans } = await supabase
        .from("executive_plans")
        .select("id")
        .in("operational_plan_month_id", planMonthIds);
      
      if (oldExecutivePlans && oldExecutivePlans.length > 0) {
        const oldPlanIds = oldExecutivePlans.map(p => p.id);
        // حذف المهام المرتبطة بالخطط القديمة
        await supabase
          .from("tasks")
          .delete()
          .in("executive_plan_id", oldPlanIds);
      }
      
      // حذف الخطط التنفيذية القديمة
      await supabase
        .from("executive_plans")
        .delete()
        .in("operational_plan_month_id", planMonthIds);

      // إدراج الخطط الجديدة
      const { data: insertedPlans, error: insertError } = await supabase
        .from("executive_plans")
        .insert(executivePlansToInsert)
        .select();

      if (insertError) {
        console.error(`Insert error for month ${targetMonth}:`, insertError);
        continue;
      }

      // إنشاء المهام المرتبطة بكل خطة تنفيذية
      const tasksToInsert: any[] = [];
      
      for (let i = 0; i < insertedPlans.length; i++) {
        const executivePlan = insertedPlans[i];
        const metadata = planMetadata[i];
        
        if (!metadata) continue;
        
        // إنشاء تاريخ المهمة
        const dueDate = new Date(targetYear, targetMonth - 1, metadata.day);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        tasksToInsert.push({
          title: metadata.activityName,
          description: `مهمة مولدة بالذكاء الاصطناعي - المستهدف: ${metadata.dailyTarget}`,
          user_id: metadata.userId,
          executive_plan_id: executivePlan.id,
          status: "pending",
          priority: "medium",
          due_date: dueDateStr,
          ai_generated: true,
          category: "خطة تنفيذية",
        });
      }
      
      if (tasksToInsert.length > 0) {
        const { data: insertedTasks, error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();
        
        if (tasksError) {
          console.error(`Tasks insert error for month ${targetMonth}:`, tasksError);
        } else {
          totalTasksGenerated += insertedTasks?.length || 0;
        }
      }

      totalPlansGenerated += insertedPlans.length;
      totalActivitiesProcessed += plansData.length;
      processedMonths.push(monthName);
    }

    if (totalPlansGenerated === 0) {
      return new Response(
        JSON.stringify({ error: "لا توجد خطط تشغيلية للأشهر المحددة" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const monthsText = processedMonths.length === 1 
      ? `شهر ${processedMonths[0]}`
      : processedMonths.length === 12
      ? "جميع الأشهر"
      : `${processedMonths.length} أشهر (${processedMonths.join("، ")})`;

    return new Response(
      JSON.stringify({
        success: true,
        plansCount: totalPlansGenerated,
        tasksCount: totalTasksGenerated,
        message: `تم توليد ${totalPlansGenerated} خطة تنفيذية و ${totalTasksGenerated} مهمة لـ${monthsText} بنجاح`,
        activitiesProcessed: totalActivitiesProcessed,
        monthsProcessed: processedMonths.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-executive-plans error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
