import { platformOnlyFetch, RuleModeError } from './automation-policy.ts';
export type RuleRow = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new RuleModeError('invalid_id', 'المعرّف غير صالح.', 400);
  return value;
}
const TABLES = new Set(['donations','donors','subscriptions','campaigns','gifts','abandoned_carts','failed_donations','tasks','operational_plans','organization_profiles','data_uploads_log','projects_catalog','marketing_campaigns','marketing_campaign_metrics','expenses','executive_plans','employees']);
export class RulePlatform {
  readonly request: typeof fetch;
  organizationId = '';
  userId = '';
  roles: string[] = [];
  readonly baseUrl: string;
  readonly anonKey: string;
  readonly authorization: string;
  constructor(baseUrl: string, anonKey: string, authorization: string, transport: typeof fetch = fetch) {
    this.baseUrl = baseUrl; this.anonKey = anonKey; this.authorization = authorization;
    this.request = platformOnlyFetch(baseUrl, transport);
  }
  async api(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.request(new URL(path, this.baseUrl), {
      ...init, headers: { apikey: this.anonKey, Authorization: this.authorization, 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) throw new RuleModeError(response.status === 401 ? 'unauthorized' : 'data_unavailable', response.status === 401 ? 'يلزم تسجيل الدخول.' : 'تعذر قراءة البيانات المصرح بها. لم يُنتج تحليل جزئي.', response.status === 401 ? 401 : 503);
    return response;
  }
  async authenticate(requestedOrg?: unknown): Promise<void> {
    if (!/^Bearer\s+\S+$/i.test(this.authorization) || !this.anonKey) throw new RuleModeError('unauthorized', 'يلزم تسجيل الدخول.', 401);
    const user = await (await this.api('/auth/v1/user')).json();
    this.userId = requireId(user.id);
    const memberships: RuleRow[] = await (await this.api('/rest/v1/user_organizations?' + new URLSearchParams({ select: 'organization_id,approval_status', user_id: `eq.${this.userId}`, approval_status: 'eq.approved' }))).json();
    const roles: RuleRow[] = await (await this.api('/rest/v1/user_roles?' + new URLSearchParams({ select: 'role,organization_id', user_id: `eq.${this.userId}` }))).json();
    const globalSuper = roles.some(x => x.role === 'super_admin' && x.organization_id === null);
    const orgIds = [...new Set(memberships.map(x => requireId(x.organization_id)))];
    if (requestedOrg) {
      const requested = requireId(requestedOrg);
      if (!orgIds.includes(requested) && !globalSuper) throw new RuleModeError('forbidden', 'لا تملك صلاحية هذه الجمعية.', 403);
      this.organizationId = requested;
    } else if (orgIds.length === 1) this.organizationId = orgIds[0];
    else throw new RuleModeError(orgIds.length ? 'organization_required' : 'forbidden', orgIds.length ? 'اختر الجمعية المطلوبة.' : 'لا توجد عضوية معتمدة لهذه الجمعية.', orgIds.length ? 400 : 403);
    this.roles = roles.filter(x => x.organization_id === this.organizationId || (x.role === 'super_admin' && x.organization_id === null)).map(x => String(x.role));
  }
  requireManager(): void {
    if (!this.roles.some(r => ['admin','moderator','super_admin'].includes(r))) throw new RuleModeError('forbidden', 'هذا التحليل متاح لمسؤول الجمعية فقط.', 403);
  }
  /** Paginate with an exact row count. Never label a capped or failed read as a full total. */
  async rows(table: string, select: string, filters: Record<string, string> = {}): Promise<RuleRow[]> {
    if (!TABLES.has(table) || !this.organizationId) throw new RuleModeError('forbidden_query', 'الاستعلام غير مسموح.', 403);
    const result: RuleRow[] = [];
    let expected: number | undefined;
    for (let offset = 0; offset < 50000; offset += 1000) {
      const query = new URLSearchParams({ ...filters, select, organization_id: `eq.${this.organizationId}`, order: 'id.asc', limit: '1000', offset: String(offset) });
      const response = await this.api(`/rest/v1/${table}?${query}`, { headers: { Prefer: 'count=exact' } });
      const total = response.headers.get('content-range')?.split('/')[1];
      if (!total || !/^\d+$/.test(total)) throw new RuleModeError('coverage_unknown', 'تعذر التحقق من اكتمال البيانات.', 503);
      const currentTotal = Number(total);
      if (expected !== undefined && currentTotal !== expected) throw new RuleModeError('data_changed', 'تغيرت البيانات أثناء القراءة. أعد المحاولة.', 409);
      expected = currentTotal;
      if (expected > 50000) throw new RuleModeError('aggregate_required', 'يتجاوز حجم البيانات حد القراءة الآمنة. يلزم تجميع قاعدة البيانات قبل المتابعة.', 422);
      const page: RuleRow[] = await response.json();
      if (!Array.isArray(page) || page.some(row => row.organization_id !== this.organizationId)) throw new RuleModeError('scope_mismatch', 'تم رفض بيانات لا تطابق نطاق الجمعية.', 403);
      result.push(...page);
      if (result.length === expected) return result;
      if (page.length !== 1000 || result.length > expected) throw new RuleModeError('coverage_incomplete', 'تعذر التحقق من اكتمال البيانات.', 503);
    }
    throw new RuleModeError('coverage_incomplete', 'البيانات غير مكتملة.', 503);
  }
}
