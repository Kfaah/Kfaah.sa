import { BUSINESS_ROUTES, generateBusinessPreview, type BusinessVerifiedData } from './rule-business.ts';
import { readBoundedBytes } from './bounded-body.ts';
import { automationMode, EXTERNAL_PROVIDER_ROUTES, RuleModeError } from './automation-policy.ts';
import { RulePlatform, requireId } from './rule-platform.ts';
import { summarizeDonorData, generateDonorInsights, generateDailyDonorReport, calendarDate, calendarWindow } from './rule-analysis.ts';
import { parseAssistantIntent, assistantEventStream } from './rule-assistant.ts';
import { parseLocalDocument, buildLocalDocumentAnalysis } from './local-document-parser.ts';
import { previewExcelPlan, previewExecutivePlans, previewTasks } from './rule-plans.ts';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json = (data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
type Environment = (name:string)=>string|undefined;
const runtimeEnv:Environment=(name)=> (globalThis as unknown as { Deno?:{ env:{get:(name:string)=>string|undefined} } }).Deno?.env.get(name);
const now = ()=>new Date().toISOString();

async function summary(client:RulePlatform) {
  client.requireManager();
  const [donations,subscriptions,campaigns,gifts,abandonedCarts,failedDonations] = await Promise.all([
    client.rows('donations','id,organization_id,donor_id,amount,currency,status,donation_date,project_id,project_name'),
    client.rows('subscriptions','id,organization_id,donor_id,amount,status,start_date,next_charge_date,end_date'),
    client.rows('campaigns','id,organization_id,name,status,collected_amount,goal_amount,start_date,end_date'),
    client.rows('gifts','id,organization_id,giver_donor_id,amount,gift_date'),
    client.rows('abandoned_carts','id,organization_id,donor_id,amount,abandoned_at,recovered'),
    client.rows('failed_donations','id,organization_id,donor_id,amount,attempted_at'),
  ]);
  return summarizeDonorData({ organizationId:client.organizationId, asOf:now(), donations, subscriptions,campaigns,gifts,abandonedCarts,failedDonations });
}
async function answer(client:RulePlatform,body:Record<string,unknown>) {
  const messages=Array.isArray(body.messages)?body.messages:[];
  const last=[...messages].reverse().find(m=>m?.role==='user');
  const parsed=parseAssistantIntent(last?.content ?? body.message);
  const scope={ organization_id:client.organizationId, as_of:now() };
  const finish=(text:string,evidence:unknown[]=[])=>assistantEventStream(text,{...scope,intent:parsed.intent,evidence});
  if(parsed.intent==='help'||parsed.intent==='clarify') return finish(parsed.clarification||'أنا مساعد آلي بقواعد محددة. اسأل عن إجمالي التبرعات، مهامك، المهام المتأخرة، أو نبذة الجمعية. لا أغيّر البيانات ولا أرسل رسائل.');
  if(parsed.intent==='organization_profile') {
    const profiles=await client.rows('organization_profiles','id,organization_id,about,goals');
    const profile=profiles[0];
    return finish(profile ? `نبذة مسجلة في الجمعية:\n${String(profile.about||'لا توجد نبذة مسجلة.')}\nالأهداف المسجلة:\n${String(profile.goals||'لا توجد أهداف مسجلة.')}` : 'لم أجد نبذة مسجلة لهذه الجمعية.',profiles.map(p=>({table:'organization_profiles',id:p.id})));
  }
  if(parsed.intent==='donation_summary') {
    client.requireManager();
    let donations=await client.rows('donations','id,organization_id,donor_id,amount,currency,status,donation_date,project_id');
    let period='كل البيانات المسجلة';
    if(parsed.period!=='all') {
      const w=calendarWindow(parsed.period,now());
      donations=donations.filter(row=>{const d=calendarDate(row.donation_date);return d&&d>=w.from&&d<=w.to;});
      period=`${w.from} إلى ${w.to}`;
    }
    const data=summarizeDonorData({organizationId:client.organizationId,asOf:now(),donations});
    return finish(`تحليل آلي للفترة: ${period}\nعدد التبرعات الناجحة: ${data.totals.donations}\nالمبلغ: ${data.totals.donations_amount.toLocaleString("ar-SA")} ر.س\nالقيم غير الصالحة: ${data.quality.invalid_values}. تُحتسب الحالات الناجحة فقط؛ لا يُفسر هذا الملخص أسباب التغير.`,[data.evidence]);
  }
  const rows=await client.rows('tasks','id,organization_id,title,status,due_date,user_id',{user_id:`eq.${client.userId}`});
  const today=calendarDate(now())!;
  const window = parsed.period === 'all' ? null : calendarWindow(parsed.period,now());
  const tasks=rows.filter(r=> {
    const due=calendarDate(r.due_date);
    return !['completed','cancelled'].includes(String(r.status)) && (parsed.intent!=='overdue_tasks'||(due!==null&&due<today)) && (!window || (due!==null&&due>=window.from&&due<=window.to));
  });
  return finish(tasks.length ? `${tasks.length} مهمة. ${tasks.length>30?'أعرض أول 30 مهمة فقط من العدد الكامل.':''}\n`+tasks.slice(0,30).map(r=>`• ${r.title} | ${r.status} | ${r.due_date||'بلا موعد'}`).join('\n') : 'لا توجد مهام مطابقة في البيانات المصرح لك بقراءتها.', tasks.slice(0,30).map(r=>({table:'tasks',id:r.id})));
}

export async function handleRulesRequest(route:string,req:Request,env:Environment=runtimeEnv,transport:typeof fetch=fetch):Promise<Response> {
  if(req.method==='OPTIONS') return new Response(null,{headers:cors});
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);
  try {
    const length=Number(req.headers.get('content-length')||0);
    if(length>1_000_000) throw new RuleModeError('request_too_large','حجم الطلب أكبر من الحد المسموح.',413);
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedBytes(req.body,1_000_000));
    if(raw.length>1_000_000) throw new RuleModeError('request_too_large','حجم الطلب أكبر من الحد المسموح.',413);
    const body=JSON.parse(raw||'{}');
    if(!body||typeof body!=='object'||Array.isArray(body)) throw new RuleModeError('invalid_request','الطلب غير صالح.',400);
    const client=new RulePlatform(env('SUPABASE_URL')||'',env('SUPABASE_ANON_KEY')||'',req.headers.get('authorization')||'',transport);
    await client.authenticate(body.organization_id ?? body.organizationId ?? body.org_id);
    if(route==='automation-preview' && body.operation==='capabilities') return json({source:'rules-v1', mode:automationMode(env('KFAAH_AUTOMATION_MODE')), preview_only:true, supported:['donors','assistant','file','plans','tasks','excel_plan'], blocked_legacy_routes:EXTERNAL_PROVIDER_ROUTES, writes_enabled:false, evaluation_policy:'unchanged_pending_owner_decision'});
    if(route==='employee-assistant'||route==='innovation-chat'||(route==='automation-preview'&&body.operation==='assistant')) return await answer(client,body);
    client.requireManager();
    if(['donor-insights','daily-donor-intelligence','run-intelligence'].includes(route)||(route==='automation-preview'&&body.operation==='donors')) {
      const data=await summary(client);
      if(route==='donor-insights') {
        const supportedPanels=['elite','overview','donors','donations','top','recurring','subscriptions','campaigns','gifts','failed','abandoned'];
        if(body.panel && !supportedPanels.includes(String(body.panel))) throw new RuleModeError('unsupported_panel','القسم غير مدعوم في التحليل الآلي.',422);
        return json({preview_only:true,...generateDonorInsights({panel:body.panel||'elite'}, {organizationId:client.organizationId,summary:data})});
      }
      return json({success:true,preview_only:true,...generateDailyDonorReport(data),summary:data,created_tasks:0,notifications_sent:0});
    }
    if(route==='analyze-uploaded-file'||(route==='automation-preview'&&body.operation==='file')) {
      const uploadId=requireId(body.upload_id);
      const uploads=await client.rows('data_uploads_log','id,organization_id,file_name,file_path,storage_bucket,detected_schema,ai_analysis',{id:`eq.${uploadId}`});
      const upload=uploads[0];
      if(!upload) throw new RuleModeError('not_found','لم يُعثر على الملف في الجمعية.',404);
      if(!upload.file_path) throw new RuleModeError('no_file','هذا السجل لا يحتوي على ملف محفوظ. أعد رفعه من مركز الملفات.',422);
      const bucket=String(upload.storage_bucket||'org-documents');
      const path=String(upload.file_path);
      if(!/^[a-z0-9-]+$/i.test(bucket)||path.split('/').some(x=>x==='..'||x==='.')||path.startsWith('/')) throw new RuleModeError('invalid_storage_path','مسار الملف غير صالح.',400);
      // Authenticated storage request preserves storage RLS; never use a public URL or a service-role bypass.
      const response=await client.api(`/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`);
      if(Number(response.headers.get('content-length')||0)>30*1024*1024) throw new RuleModeError('too_large','حجم الملف أكبر من الحد المسموح.',413);
      const bytes=await readBoundedBytes(response.body,30*1024*1024);
      const parsed=await parseLocalDocument({fileName:String(upload.file_name),bytes});
      const analysis=buildLocalDocumentAnalysis(parsed,{fileName:String(upload.file_name),detectedSchema:typeof upload.detected_schema==='string'?upload.detected_schema:undefined});
      return json({success:true,preview_only:true,source:'rules-v1',analysis,chars:parsed.text.length,routed_to:null,legacy_analysis_preserved:Boolean(upload.ai_analysis)});
    }
    if((route==='automation-preview'&&body.operation==='excel_plan')||route==='generate-plan-from-excel') return json(previewExcelPlan({...body,organization_id:client.organizationId} as Parameters<typeof previewExcelPlan>[0]));
    if((route==='automation-preview'&&['plans','tasks'].includes(String(body.operation)))||['generate-executive-plans','generate-tasks','generate-plan-deep','generate-action-plan'].includes(route)) {
      const year=Number(body.year||new Date().getUTCFullYear());
      const plans=await client.rows('operational_plans','id,organization_id,year,activity_name,annual_target,responsible_employee_id,strategic_goal,estimated_budget,months:operational_plan_months(id,month,monthly_target)',{year:`eq.${year}`});
      const employees=await client.rows('employees','id,organization_id');
      const authorizedEmployees=new Set(employees.map(row=>row.id));
      const scopedPlans=plans.map(plan=>({...plan,responsible_employee_id:authorizedEmployees.has(plan.responsible_employee_id)?plan.responsible_employee_id:null}));
      const input={organization_id:client.organizationId,year,months:Array.isArray(body.months)?body.months:[Number(body.month)||new Date().getUTCMonth()+1],plans:scopedPlans};
      const wantsTasks=body.operation==='tasks'||route==='generate-tasks';
      const preview=wantsTasks?previewTasks({...input,existing_tasks:await client.rows('tasks','id,organization_id,title,status,due_date,executive_plan_id,source_activity_id,metadata,phase,dedupe_key')} as Parameters<typeof previewTasks>[0]):previewExecutivePlans(input as Parameters<typeof previewExecutivePlans>[0]);
      if(route!=='automation-preview') return json({error:'preview_requires_review',message:'أُعدت مسودة آلية فقط. افتح معاينة القواعد لمراجعتها؛ لم تُحفظ خطط أو تُسند مهام.',preview},409);
      return json(preview);
    }
    const businessRoute = route === 'automation-preview' && body.operation === 'business' ? String(body.route) : route;
    if ((BUSINESS_ROUTES as readonly string[]).includes(businessRoute)) {
      const verified:BusinessVerifiedData = { organizationId:client.organizationId };
      if (businessRoute==='marketing-suggest-campaigns') verified.projects=await client.rows('projects_catalog','id,organization_id,name,is_active');
      if (['suggest-finance-reports','executive-report','admin-insights'].includes(businessRoute)) {
        verified.expenses=await client.rows('expenses','id,organization_id,description,amount,kind,status,expense_date,project_id,project_name');
        verified.donations=await client.rows('donations','id,organization_id,amount,currency,status,donation_date,donor_id,project_id,project_name');
        verified.summary=summarizeDonorData({organizationId:client.organizationId,asOf:now(),donations:verified.donations});
      }
      if (['marketing-evaluate-campaign','marketing-design-brief','marketing-generate-content'].includes(businessRoute)) {
        const campaignId=requireId(body.campaign_id);
        const campaigns=await client.rows('marketing_campaigns','id,organization_id,name,goal,primary_message,related_project,audience_segment,start_date,end_date,budget_planned,budget_actual,status,ai_generated',{id:`eq.${campaignId}`});
        if (!campaigns.length) throw new RuleModeError('not_found','الحملة غير موجودة ضمن الجمعية.',404);
        verified.campaign=campaigns[0];
        if (businessRoute==='marketing-evaluate-campaign') verified.campaignMetrics=await client.rows('marketing_campaign_metrics','id,organization_id,campaign_id,channel,impressions,clicks,conversions,cost,donations_amount,donations_count,measured_at',{campaign_id:`eq.${campaignId}`});
      }
      // Client aggregates are explicitly labelled as supplied input by this pure preview core.
      // No user-provided currency or cumulative-metric grain is promoted to a verified storage contract.
      return json(generateBusinessPreview(businessRoute,body,verified));
    }
    const reviewOnly=['evaluate-task-quality','verify-evidence'].includes(route);
    throw new RuleModeError(reviewOnly?'human_review_required':'rule_capability_not_available',reviewOnly?'هذا الحكم يحتاج مراجعة بشرية وسياسة تقييم معتمدة. لم تتغير أي درجة أو حالة.':'هذه الميزة غير متاحة بعد في وضع القواعد. استخدم شاشة المعاينة الآلية للقدرات المدعومة؛ لم يُستدعَ مزوّد خارجي.',422);
  } catch(error) {
    if(error instanceof RuleModeError) return json({error:error.code,message:error.message,source:'rules-v1'},error.status);
    const parserError=error as {code?:string;message?:string};
    if(parserError.code) return json({error:parserError.code,message:parserError.message,source:'rules-v1'},422);
    return json({error:'rule_processing_failed',message:'تعذرت المعالجة الآلية. لم يُستدعَ مزوّد خارجي ولم تتغير البيانات.',source:'rules-v1'},400);
  }
}

/** All provider entrypoints are wrapped before any legacy authorization, background work or fetch. */
export function withRulesMode(route:string,legacy:(req:Request)=>Promise<Response>|Response,env:Environment=runtimeEnv) {
  return (req:Request):Promise<Response>|Response => automationMode(env('KFAAH_AUTOMATION_MODE'))==='rules' ? handleRulesRequest(route,req,env) : legacy(req);
}
