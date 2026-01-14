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

    // أولاً: جلب الأشهر التي فيها خطط تشغيلية فعلاً للموظفين المحددين
    let monthsQuery = supabase
      .from("operational_plan_months")
      .select(`
        month,
        operational_plans!inner (
          user_id,
          year
        )
      `)
      .eq("operational_plans.year", targetYear);

    if (userIds && userIds.length > 0) {
      monthsQuery = monthsQuery.in("operational_plans.user_id", userIds);
    }

    const { data: availableMonths, error: monthsError } = await monthsQuery;
    
    if (monthsError) {
      console.error("Error fetching available months:", monthsError);
    }

    // استخراج الأشهر المتاحة فقط
    const monthsWithPlans = [...new Set((availableMonths || []).map((m: any) => m.month))];
    
    // تصفية الأشهر المطلوبة لتشمل فقط تلك التي فيها خطط تشغيلية
    const filteredTargetMonths = targetMonths.filter(m => monthsWithPlans.includes(m));
    
    if (filteredTargetMonths.length === 0) {
      const requestedMonthsText =
        targetMonths.length === 12
          ? "جميع الأشهر"
          : targetMonths.map((m) => MONTHS_AR[m - 1]).filter(Boolean).join("، ");

      return new Response(
        JSON.stringify({
          success: false,
          error: `لا توجد خطط تشغيلية للأشهر المحددة (${requestedMonthsText}) لعام ${targetYear}`,
          monthsRequested: targetMonths,
          monthsWithPlans: monthsWithPlans,
          year: targetYear,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    let totalPlansGenerated = 0;
    let totalTasksGenerated = 0;
    let totalActivitiesProcessed = 0;
    const processedMonths: string[] = [];

    // معالجة كل شهر على حدة (فقط الأشهر التي فيها خطط تشغيلية)
    for (const targetMonth of filteredTargetMonths) {
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
      const systemPrompt = `أنت مستشار تخطيط استراتيجي متخصص في توزيع المستهدفات على أيام العمل وتفصيل المهام.

مهمتك الأولى: توزيع المستهدف الشهري على أيام العمل بشكل ذكي ومتوازن.
مهمتك الثانية: لكل يوم تنفيذي، توليد مهام تفصيلية مقسمة إلى ثلاث مراحل:
- مهام ما قبل (التحضير والإعداد)
- مهام أثناء (التنفيذ الفعلي)
- مهام ما بعد (المتابعة والتوثيق)

ملاحظة مهمة جداً:
- قد يكون في اليوم الواحد عدة أنشطة لأنها تخص أقساماً/موظفين مختلفين.
- تكرار نفس اليوم بين أنشطة مختلفة مقبول ومطلوب.

قواعد التوزيع:
1. تجنب أيام الجمعة والسبت (عطلة نهاية الأسبوع)
2. وزّع المستهدف بشكل متساوي قدر الإمكان
3. إذا كان المستهدف صغير (1-4)، اختر أيام متفرقة
4. إذا كان المستهدف كبير، وزّعه على معظم أيام العمل
5. تأكد أن مجموع المستهدفات اليومية يساوي المستهدف الشهري

قواعد المهام:
1. كل يوم تنفيذي يحتاج 3-5 مهام كحد أدنى
2. المهام يجب أن تكون عملية ومحددة وقابلة للقياس
3. اجعل المهام متناسبة مع طبيعة النشاط

يجب أن ترد باستخدام الأداة distribute_targets_with_tasks فقط.`;

      const userPrompt = `الشهر: ${monthName} ${targetYear}
عدد أيام الشهر: ${daysInMonth}

الخطط التشغيلية المطلوب توزيعها:
${plansData
  .map(
    (p, i) => `
${i + 1}. النشاط: ${p.activityName}
   المبادرة: ${p.initiative || "غير محدد"}
   الهدف الاستراتيجي: ${p.strategicGoal || "غير محدد"}
   المستهدف الشهري: ${p.monthlyTarget}
   الموظف: ${p.employeeName} (${p.jobRole})
`
  )
  .join("\\n")}

قم بـ:
1. توزيع المستهدف الشهري لكل نشاط على أيام العمل المناسبة
2. لكل يوم تنفيذي، أنشئ مهام تفصيلية مقسمة إلى (قبل - أثناء - بعد)

تنبيه: من الطبيعي أن يتكرر نفس اليوم بين عدة أنشطة.`;

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // قائمة النماذج للتجربة (fallback)
      const models = ["openai/gpt-5-mini", "google/gemini-2.5-flash", "google/gemini-3-flash-preview"];

      const buildAiBody = (model: string) => ({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "distribute_targets_with_tasks",
              description: "توزيع المستهدفات الشهرية على الأيام مع المهام التفصيلية",
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
                          description: "رقم النشاط (يبدأ من 0)",
                        },
                        days: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              day: { type: "number", description: "رقم اليوم في الشهر" },
                              target: { type: "number", description: "المستهدف لهذا اليوم" },
                              tasks: {
                                type: "object",
                                properties: {
                                  before: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "مهام ما قبل التنفيذ (التحضير والإعداد)",
                                  },
                                  during: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "مهام أثناء التنفيذ",
                                  },
                                  after: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "مهام ما بعد التنفيذ (المتابعة والتوثيق)",
                                  },
                                },
                                required: ["before", "during", "after"],
                              },
                            },
                            required: ["day", "target", "tasks"],
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
        tool_choice: { type: "function", function: { name: "distribute_targets_with_tasks" } },
        temperature: 0.2,
      });

      let data: any = null;

      // محاولة مع كل نموذج حتى النجاح
      modelLoop: for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 55_000);

          try {
            console.log(`Trying model ${model}, attempt ${attempt} for month ${targetMonth}`);
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildAiBody(model)),
              signal: controller.signal,
            });

            if (!response.ok) {
              if (response.status === 429) {
                return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
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

              const errorText = await response.text().catch(() => "");
              console.error(`AI HTTP ${response.status} with ${model} attempt ${attempt}:`, errorText.substring(0, 300));
              if (attempt < 2) await sleep(1200);
              continue;
            }

            const json = await response.json().catch(() => ({ error: { message: "Invalid JSON" } }));

            if (json?.error) {
              console.error(`AI provider error with ${model} attempt ${attempt}:`, JSON.stringify(json.error).substring(0, 300));
              if (attempt < 2) await sleep(1200);
              continue;
            }

            data = json;
            console.log(`Success with model ${model} for month ${targetMonth}`);
            break modelLoop;
          } catch (e) {
            console.error(`AI fetch error with ${model} attempt ${attempt}:`, e);
            if (attempt < 2) await sleep(1200);
          } finally {
            clearTimeout(timeout);
          }
        }
      }

      if (!data) {
        console.error(`AI failed completely for month ${targetMonth} after trying all models`);
        continue;
      }

      console.log(`AI response for month ${targetMonth}:`, JSON.stringify(data).substring(0, 500));
      
      const message = data.choices?.[0]?.message;
      let distributions: any;
      
      // محاولة استخراج البيانات من tool_calls
      const toolCall = message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        try {
          distributions = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error(`Failed to parse tool_calls for month ${targetMonth}:`, e);
        }
      }
      
      // إذا فشل، محاولة استخراج من function_call (نسخة قديمة)
      if (!distributions && message?.function_call?.arguments) {
        try {
          distributions = JSON.parse(message.function_call.arguments);
        } catch (e) {
          console.error(`Failed to parse function_call for month ${targetMonth}:`, e);
        }
      }
      
      // إذا فشل، محاولة استخراج JSON من النص
      if (!distributions && message?.content) {
        try {
          const jsonMatch = message.content.match(/\{[\s\S]*"distributions"[\s\S]*\}/);
          if (jsonMatch) {
            distributions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error(`Failed to parse content JSON for month ${targetMonth}:`, e);
        }
      }
      
      if (!distributions || !distributions.distributions) {
        console.error(`No valid distributions found for month ${targetMonth}. Full response:`, JSON.stringify(data));
        continue;
      }
      const executivePlansToInsert: any[] = [];
      const planMetadata: { 
        planMonthId: string; 
        day: number; 
        activityName: string; 
        userId: string; 
        dailyTarget: number;
        tasks?: { before: string[]; during: string[]; after: string[] };
      }[] = [];

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
            tasks: dayData.tasks || { before: [], during: [], after: [] },
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

      // إنشاء المهام المرتبطة بكل خطة تنفيذية (متعددة لكل خطة)
      const tasksToInsert: any[] = [];
      
      for (let i = 0; i < insertedPlans.length; i++) {
        const executivePlan = insertedPlans[i];
        const metadata = planMetadata[i];
        
        if (!metadata) continue;
        
        // إنشاء تاريخ المهمة
        const dueDate = new Date(targetYear, targetMonth - 1, metadata.day);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        const phases = [
          { phase: "before", label: "ما قبل", priority: "high" as const },
          { phase: "during", label: "أثناء", priority: "medium" as const },
          { phase: "after", label: "ما بعد", priority: "low" as const },
        ];
        
        for (const { phase, label, priority } of phases) {
          const phaseTasks = metadata.tasks?.[phase as keyof typeof metadata.tasks] || [];
          
          for (const taskTitle of phaseTasks) {
            if (!taskTitle || taskTitle.trim() === "") continue;
            
            tasksToInsert.push({
              title: taskTitle,
              description: `${label} - ${metadata.activityName}`,
              user_id: metadata.userId,
              executive_plan_id: executivePlan.id,
              status: "pending",
              priority,
              due_date: dueDateStr,
              ai_generated: true,
              category: label, // استخدام المرحلة كتصنيف
            });
          }
        }
        
        // إذا لم تُولّد مهام، أنشئ مهمة واحدة على الأقل
        if (!metadata.tasks || 
            ((!metadata.tasks.before || metadata.tasks.before.length === 0) && 
             (!metadata.tasks.during || metadata.tasks.during.length === 0) && 
             (!metadata.tasks.after || metadata.tasks.after.length === 0))) {
          tasksToInsert.push({
            title: metadata.activityName,
            description: `مهمة مولدة بالذكاء الاصطناعي - المستهدف: ${metadata.dailyTarget}`,
            user_id: metadata.userId,
            executive_plan_id: executivePlan.id,
            status: "pending",
            priority: "medium",
            due_date: dueDateStr,
            ai_generated: true,
            category: "أثناء",
          });
        }
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
      const requestedMonthsText =
        targetMonths.length === 12
          ? "جميع الأشهر"
          : targetMonths.map((m) => MONTHS_AR[m - 1]).filter(Boolean).join("، ");

      return new Response(
        JSON.stringify({
          success: false,
          error: `لا توجد خطط تشغيلية للأشهر المحددة (${requestedMonthsText}) لعام ${targetYear}`,
          monthsRequested: targetMonths,
          year: targetYear,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
