/** The only value that enables the retained model implementation is explicit legacy_ai. */
export type AutomationMode = 'rules' | 'legacy_ai';
export function automationMode(value?: string): AutomationMode {
  return value === 'legacy_ai' ? 'legacy_ai' : 'rules';
}

export const EXTERNAL_PROVIDER_ROUTES = [
  'admin-insights', 'analyze-organization', 'analyze-uploaded-file', 'classify-expense-batch',
  'daily-donor-intelligence', 'deep-org-analysis', 'discover-org-accounts', 'donor-insights',
  'employee-assistant', 'evaluate-task-quality', 'executive-report', 'extract-website-info',
  'generate-action-plan', 'generate-executive-plans', 'generate-plan-deep',
  'generate-plan-from-excel', 'generate-related-tasks', 'generate-smart-report',
  'generate-tasks', 'innovation-chat', 'innovation-suggestions', 'marketing-design-brief',
  'marketing-evaluate-campaign', 'marketing-generate-content', 'marketing-suggest-campaigns',
  'report-suggestions', 'run-intelligence', 'store-deep-analysis', 'suggest-finance-reports',
  'sync-external-source', 'tts-arabic', 'verify-evidence',
] as const;

export class RuleModeError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 422) { super(message); this.code = code; this.status = status; }
}

/** Capability-specific allowlist, not a list of known AI brands. Custom proxies fail closed too. */
export function platformOnlyFetch(platformUrl: string, transport: typeof fetch = fetch): typeof fetch {
  const platform = new URL(platformUrl);
  if (!['https:', 'http:'].includes(platform.protocol) || platform.username || platform.password) {
    throw new RuleModeError('invalid_platform_url', 'إعداد اتصال المنصة غير صالح.', 503);
  }
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = url.pathname;
    const allowedPath = path === '/auth/v1/user' || path.startsWith('/rest/v1/') || path.startsWith('/storage/v1/object/authenticated/');
    if (url.origin !== platform.origin || !allowedPath || url.username || url.password) {
      throw new RuleModeError('external_egress_blocked', 'وضع القواعد يمنع الاتصال بالخدمات الخارجية.', 503);
    }
    // A trusted endpoint must not redirect a bearer token or private rows to a different origin.
    const response = await transport(input, { ...init, redirect: 'error' });
    if (response.redirected || (response.url && new URL(response.url).origin !== platform.origin)) {
      throw new RuleModeError('external_redirect_blocked', 'تم رفض إعادة توجيه الاتصال.', 503);
    }
    return response;
  }) as typeof fetch;
}

export function routeByMode<T>(mode: string | undefined, rules: () => T, legacy: () => T): T {
  return automationMode(mode) === 'rules' ? rules() : legacy();
}
