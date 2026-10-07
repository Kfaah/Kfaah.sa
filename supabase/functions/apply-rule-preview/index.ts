import { handleRuleApprovalRequest } from '../_shared/rule-approval.ts';

// Never routes through a legacy/provider implementation, including legacy_ai mode.
Deno.serve(req => handleRuleApprovalRequest(req));
