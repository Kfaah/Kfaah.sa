import { handleRulesRequest } from '../_shared/rule-mode.ts';
Deno.serve((req) => handleRulesRequest('automation-preview', req));
