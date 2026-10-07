/**
 * Explicit review/commit boundary for the deliberately small SQL approval contract.
 * The browser supplies selectors, never task rows. The database derives, hashes,
 * locks and rechecks the source, and atomically inserts only the reviewed tasks.
 * Both switches default off. The private database switch is authoritative;
 * this environment switch additionally gates the edge route/UI, not direct RPC.
 */
import { RuleModeError } from './automation-policy.ts';
import { readBoundedBytes } from './bounded-body.ts';
import { RulePlatform, requireId } from './rule-platform.ts';

export const APPROVAL_CONTRACT = 'rule-approved-month-v1';
export const APPROVAL_BODY_LIMIT = 16_384;
export type ApprovalSelection = {
  organization_id: string;
  source_plan_id: string;
  source_month_id: string;
  assigned_employee_id: string;
  task_dates: string[];
};
export type ApprovalRequest = ApprovalSelection & {
  action: 'review' | 'commit';
  review_hash?: string;
  confirmed?: true;
};
type Environment = (name: string) => string | undefined;
const runtimeEnv: Environment = name => (globalThis as unknown as { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env.get(name);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const invalid = (): never => { throw new RuleModeError('invalid_approval_request', 'حدد خطة وشهراً وموظفاً وأياماً صريحة للمراجعة.', 400); };
export function parseApprovalRequest(input: unknown): ApprovalRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const body = input as Record<string, unknown>;
  if (!['review', 'commit'].includes(String(body.action))) return invalid();
  const allowed = new Set(['action', 'organization_id', 'source_plan_id', 'source_month_id', 'assigned_employee_id', 'task_dates', ...(body.action === 'commit' ? ['review_hash', 'confirmed'] : [])]);
  if (Object.keys(body).some(key => !allowed.has(key))) return invalid();
  if (!Array.isArray(body.task_dates) || body.task_dates.length < 1 || body.task_dates.length > 31) return invalid();
  const dates = body.task_dates;
  for (const date of dates) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid();
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return invalid();
  }
  if (new Set(dates).size !== dates.length || dates.some(date => date.slice(0, 7) !== dates[0].slice(0, 7))) return invalid();
  const selection: ApprovalSelection = {
    organization_id: requireId(body.organization_id).toLowerCase(),
    source_plan_id: requireId(body.source_plan_id).toLowerCase(),
    source_month_id: requireId(body.source_month_id).toLowerCase(),
    assigned_employee_id: requireId(body.assigned_employee_id).toLowerCase(),
    task_dates: [...dates].sort(),
  };
  if (body.action === 'review') return { action: 'review', ...selection };
  if (body.confirmed !== true) throw new RuleModeError('confirmation_required', 'راجع المعاينة ثم أكد حفظ المهام المحددة صراحة.', 400);
  if (typeof body.review_hash !== 'string' || !/^[a-f0-9]{64}$/.test(body.review_hash)) throw new RuleModeError('review_hash_required', 'يلزم رمز المراجعة الحالي الذي أعادته المعاينة.', 400);
  return { action: 'commit', ...selection, review_hash: body.review_hash, confirmed: true };
}

export async function sha256Text(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
function selectionOf(input: ApprovalRequest): ApprovalSelection {
  const { organization_id, source_plan_id, source_month_id, assigned_employee_id, task_dates } = input;
  return { organization_id, source_plan_id, source_month_id, assigned_employee_id, task_dates };
}
function equalSelection(a: unknown, b: ApprovalSelection): boolean {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
  const value = a as Record<string, unknown>;
  return Object.keys(value).length === 5 && ['organization_id', 'source_plan_id', 'source_month_id', 'assigned_employee_id'].every(key => value[key] === b[key as keyof ApprovalSelection]) && JSON.stringify(value.task_dates) === JSON.stringify(b.task_dates);
}
/** Verify the exact server string rather than reserializing PostgreSQL JSONB. */
export async function verifyReviewEnvelope(input: unknown, request: ApprovalSelection, userId: string): Promise<Record<string, unknown>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RuleModeError('invalid_review_response', 'تعذر التحقق من المعاينة.', 502);
  const envelope = input as Record<string, unknown>;
  if (typeof envelope.review_json !== 'string' || envelope.review_json.length > 200_000 || typeof envelope.review_hash !== 'string' || await sha256Text(envelope.review_json) !== envelope.review_hash) throw new RuleModeError('invalid_review_response', 'تعذر التحقق من سلامة المعاينة.', 502);
  let review: Record<string, unknown>;
  try { review = JSON.parse(envelope.review_json); } catch { throw new RuleModeError('invalid_review_response', 'تعذر قراءة المعاينة.', 502); }
  if (!review || review.contract !== APPROVAL_CONTRACT || review.user_id !== userId || !equalSelection(review.selection, request) || !Array.isArray(review.tasks) || !Array.isArray(review.preserved_tasks) || review.tasks.length > request.task_dates.length) throw new RuleModeError('invalid_review_response', 'المعاينة لا تطابق نطاق الطلب.', 502);
  return { ...envelope, review };
}

const rpcErrors: Record<string, { status: number; message: string }> = {
  approval_forbidden: { status: 403, message: 'لا تملك صلاحية حفظ مهام هذه الجمعية.' },
  approval_source_not_found: { status: 404, message: 'المصدر أو الموظف غير موجود ضمن الجمعية.' },
  approval_source_requires_review: { status: 422, message: 'بيانات المصدر أو الإسناد تحتاج مراجعة بشرية.' },
  approval_invalid_selection: { status: 400, message: 'الأيام أو الموظف لا يطابقون المصدر المعتمد.' },
  approval_stale_review: { status: 409, message: 'تغيرت بيانات المعاينة. راجع نسخة جديدة قبل الحفظ.' },
  approval_confirmation_required: { status: 400, message: 'يلزم التأكيد الصريح ورمز المراجعة الحالي.' },
  approval_persistence_disabled: { status: 503, message: 'الحفظ معطل حتى اعتماد الترحيل واختبارات بيئة التجربة.' },
  approval_unsafe_database_hooks: { status: 503, message: 'يلزم التحقق من قواعد قاعدة البيانات قبل السماح بالحفظ.' },
};
async function approvalRpc(client: RulePlatform, name: 'review_rule_month' | 'apply_rule_month', args: Record<string, unknown>): Promise<unknown> {
  // This is the same user bearer token and anon key; never a service role.
  let response: Response;
  try {
    response = await client.request(new URL(`/rest/v1/rpc/${name}`, client.baseUrl), {
      method: 'POST', headers: { apikey: client.anonKey, Authorization: client.authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
    });
  } catch (error) {
    if (error instanceof RuleModeError) throw error;
    throw new RuleModeError(name === 'apply_rule_month' ? 'approval_result_unknown' : 'approval_database_unavailable', 'تعذر التحقق من نتيجة قاعدة البيانات؛ لا تكرر الحفظ تلقائياً.', 503);
  }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBytes(response.body, 300_000));
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new RuleModeError('approval_database_unavailable', 'تعذر التحقق من نتيجة قاعدة البيانات؛ لا تكرر الحفظ تلقائياً.', 503); }
  if (!response.ok) {
    const message = data && typeof data === 'object' ? (data as Record<string, unknown>).message : null;
    const mapped = typeof message === 'string' ? rpcErrors[message] : undefined;
    if (mapped) throw new RuleModeError(String(message), mapped.message, mapped.status);
    throw new RuleModeError('approval_database_unavailable', 'تعذر التحقق من نتيجة قاعدة البيانات؛ لا تكرر الحفظ تلقائياً.', 503);
  }
  return data;
}

export async function handleRuleApprovalRequest(req: Request, env: Environment = runtimeEnv, transport: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    if (Number(req.headers.get('content-length') || 0) > APPROVAL_BODY_LIMIT) throw new RuleModeError('request_too_large', 'الطلب أكبر من الحد المسموح.', 413);
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(await readBoundedBytes(req.body, APPROVAL_BODY_LIMIT));
    const body = parseApprovalRequest(JSON.parse(raw));
    const client = new RulePlatform(env('SUPABASE_URL') || '', env('SUPABASE_ANON_KEY') || '', req.headers.get('authorization') || '', transport);
    await client.authenticate(body.organization_id);
    // Narrower than read-only manager previews: current task INSERT RLS grants administrators.
    if (!client.roles.some(role => role === 'admin' || role === 'super_admin')) throw new RuleModeError('approval_forbidden', rpcErrors.approval_forbidden.message, 403);
    const selection = selectionOf(body);
    if (body.action === 'review') {
      const data = await approvalRpc(client, 'review_rule_month', { p_selection: selection });
      const envelope = await verifyReviewEnvelope(data, selection, client.userId);
      return json({ ...envelope, source: 'rules-v1', preview_only: true, requires_confirmation: true, edge_enabled: env('KFAAH_RULE_PERSISTENCE') === 'approved_month_v1', writes_enabled: env('KFAAH_RULE_PERSISTENCE') === 'approved_month_v1' && envelope.database_enabled === true && (envelope.review as Record<string, unknown>).can_commit === true, writes_performed: 0, notifications_sent: 0 });
    }
    if (env('KFAAH_RULE_PERSISTENCE') !== 'approved_month_v1') throw new RuleModeError('approval_persistence_disabled', rpcErrors.approval_persistence_disabled.message, 503);
    const result = await approvalRpc(client, 'apply_rule_month', { p_selection: selection, p_review_hash: body.review_hash, p_confirmed: true });
    if (!result || typeof result !== 'object' || Array.isArray(result) || (result as Record<string, unknown>).review_hash !== body.review_hash || (result as Record<string, unknown>).organization_id !== client.organizationId || (result as Record<string, unknown>).user_id !== client.userId || !['applied', 'already_applied'].includes(String((result as Record<string, unknown>).status))) throw new RuleModeError('approval_result_unknown', 'تعذر التحقق من نتيجة الحفظ. تحقق من المهام قبل إعادة المحاولة.', 503);
    return json({ ...result, source: 'rules-v1', preview_only: false });
  } catch (error) {
    if (error instanceof RuleModeError) return json({ error: error.code, message: error.message, source: 'rules-v1' }, error.status);
    return json({ error: 'approval_processing_failed', message: 'تعذرت معالجة الطلب. لا تكرر الحفظ تلقائياً.', source: 'rules-v1' }, 400);
  }
}
