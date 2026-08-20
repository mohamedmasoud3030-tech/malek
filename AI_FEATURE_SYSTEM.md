# MALEK AI Feature System

**Status:** repository design and safety contract; not proof of live deployment  
**Date:** 2026-08-19  
**Canonical rules:** PRD-008, SEC-005, SEC-010, UX-007  
**Owner:** Platform  
**Prompt version:** `malek-ops-ar-v2`  
**Output schema:** `assistant-response-v1`

## 1. Decision and scope

The repository has one AI-powered product surface: the read-only AI Assistant at `/ai-assistant`. It is not accounting authority, a financial source of truth, or an action-taking agent. A repository-wide search found no other model SDK, model endpoint, embedding pipeline, vector store, AI upload processor, or model tool runner.

The assistant is useful only where language generation improves the outcome. Factual aggregation is more reliable and cheaper in deterministic code.

| Use case                                                                        | Decision                  | Runtime path                                                    | Rationale                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Overdue invoice summary                                                         | Keep, but no model        | Deterministic formatter over authorized aggregate context       | Counts, dates and OMR totals must not be invented or recomputed by a model.                                                 |
| Contract renewal summary                                                        | Keep, but no model        | Deterministic formatter                                         | The useful output is a factual queue summary.                                                                               |
| Property financial snapshot explanation                                         | Keep, but no model        | Deterministic formatter with explicit non-accounting disclaimer | Arithmetic and report status belong to code and canonical reports.                                                          |
| Tenant payment reminder draft                                                   | Keep as assisted drafting | Model when available; safe generic draft on provider failure    | Language quality can improve tone, but a human must check recipient, amount and date and must send it outside this feature. |
| Free-form operational question                                                  | Keep as beta              | Model, constrained to minimized read-only context               | Useful for explanation, but must state uncertainty and defer to source screens.                                             |
| SQL, mutations, communications, approvals, payments, legal/accounting decisions | Prohibit                  | Refusal; no tools exist                                         | Externally consequential or authoritative actions require controlled application workflows and human confirmation.          |

No upload, OCR, image, audio, retrieval-augmented generation, embedding, web browsing, database tool, function calling, autonomous loop, background agent, or streaming response is supported. Adding any of these is a new reviewed use case, not an extension hidden inside a prompt.

## 2. Current inventory

| Layer               | Repository reality                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI                  | Arabic-first standalone route with an AI disclosure, read-only statement, source/fallback label and caveats.                                                                                                                             |
| Context retrieval   | Browser Supabase reads under the authenticated session and RLS; only fixed aggregates and at most 25 opaque top-row records are shaped. The Edge Function rejects unknown context keys, excessive depth/list size and oversized strings. |
| Provider            | One `openai-compatible` adapter. Default endpoint host is `api.openai.com`; custom HTTPS hosts require `AI_PROVIDER_ALLOWED_HOSTS`. No provider SDK is bundled.                                                                          |
| Model               | Deployment-owned `AI_PROVIDER_MODEL`; there is no silent model fallback. This change does not select or change a live model.                                                                                                             |
| Prompt              | Versioned system prompt in the Edge Function; untrusted request/history/context are delimited and explicitly treated as data.                                                                                                            |
| Output              | Strict JSON schema `{answer, grounded, caveats}` at the provider and a second local validator. The frontend validates the Edge response again.                                                                                           |
| Moderation          | Local high-risk secret/instruction-exfiltration refusal and SQL rejection. There is no claim that this replaces a provider safety system.                                                                                                |
| Tools/actions       | None. The function has no business-table write client and no tool-call executor.                                                                                                                                                         |
| Streaming           | None. One bounded request simplifies validation and accounting.                                                                                                                                                                          |
| Retries             | Zero paid-call retries. This prevents duplicate charges; transient/provider/malformed failures use a deterministic fallback.                                                                                                             |
| Fallback            | Deterministic summaries for factual actions; generic reviewed reminder draft; generic non-authoritative failure response for free-form analysis. No second paid provider is called.                                                      |
| Quotas              | Warm-worker burst shedding plus distributed 10/minute quota.                                                                                                                                                                             |
| Budgets/idempotency | Atomic request UUID reservation, per-user daily request limit and per-company daily micro-USD ceiling. Duplicate request IDs are rejected before a provider call.                                                                        |
| Logs                | Request UUID, provider adapter name, configured model, action, latency and token counts when returned. No prompt, context, response, email, tenant name, API key or JWT.                                                                 |
| Analytics           | Operational metadata only through server logs. No product analytics payload containing conversation content is implemented.                                                                                                              |
| Storage/retention   | Conversation state is in the current browser component only. The budget ledger stores company/user/request IDs, date and reserved cost—not prompts or responses. Provider retention remains an external contract item.                   |
| Feature rollout     | Existing beta feature flag targets company ADMIN/MANAGER. Server authorization now enforces the same active-company roles; the client flag is not treated as authorization.                                                              |

## 3. Provider and model policy

1. Provider-specific request/response handling stays behind `AiProviderAdapter`; business code must not parse provider envelopes.
2. Production may use only a security/procurement-approved provider and region with a signed data-processing position, no training on submitted data, documented retention, incident notification and deletion terms.
3. `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`, endpoint and host allowlist are server secrets/configuration. They never enter the Vite bundle.
4. A model is selected by measured Arabic instruction following, schema adherence, groundedness, latency, context support, provider support and total cost—not benchmark popularity.
5. A model/version change requires owner approval, a new evaluation record, staged rollout and rollback configuration. This repository change intentionally does **not** change or enable a live model or paid account.
6. There is no cross-provider fallback until a second provider has separate privacy approval. Fallback is local deterministic behavior.
7. Current limits: 2,400 prompt characters, six history messages × 1,200 characters, 9,000 serialized context characters, 700 output tokens, 20-second provider timeout, one provider attempt.

## 4. Prompt and version management

- Every material system prompt or output contract change increments `AI_PROMPT_VERSION` or `AI_OUTPUT_SCHEMA_VERSION`.
- The prompt states the read-only boundary, source-grounding requirement, untrusted-data boundary, secret rules, no identity inference, no authoritative legal/accounting/financial advice and human review requirement.
- User/history/context text cannot change system policy. Prompt injection is handled as hostile content, not privileged instructions.
- Prompt text and evaluation changes must be reviewed together. Avoid provider-console prompts that cannot be reproduced from Git.
- Logs identify the prompt/schema versions returned to the client without storing content.

## 5. Authorization, privacy and data handling

1. Authentication and active-company `ADMIN`/`MANAGER` authorization happen at the Edge boundary before a response or provider call. RLS remains authoritative for the upstream context reads.
2. The browser cannot choose a company for quota/budget controls; database functions derive the actor and active company from authenticated context.
3. The context allowlist excludes names, email, phone, notes, document text and communication bodies. Opaque record IDs and aggregates remain business-confidential and may be sent only after provider approval.
4. Never paste personal data, credentials, legal documents, bank files, medical data or unrestricted free text into prompts. Uploaded files are unsupported.
5. No cross-session memory, cross-user cache or shared conversation store exists.
6. Model output is untrusted plain text rendered through React; it cannot become SQL, HTML, a tool call, a financial posting or an approval.
7. Provider input/output content must not be added to routine logs or analytics. Temporary incident capture requires explicit security approval, redaction, access controls and a deletion deadline.

## 6. Safety and reliability controls

- **Prompt injection/exfiltration:** fixed system precedence, untrusted delimiters, strict context shape, local high-risk refusal, no secret/tool access.
- **Cross-company access:** authenticated RLS reads plus server active-company authorization and company-scoped quota/budget records.
- **Hallucination:** deterministic factual paths; `grounded` output field; caveats; source UI remains authoritative.
- **Unsafe autonomy:** no tools, loops, background execution or outbound send path.
- **Consequential actions:** the assistant cannot execute them. Drafts require a human to verify and use an authorized workflow. Destructive, financial, legal, medical and external actions always require explicit human confirmation in their authoritative feature.
- **Malformed output:** strict provider JSON schema and local validation; malformed output is discarded, never partially rendered.
- **Provider failure/latency:** 20-second timeout, no paid retry, local fallback and `degraded` metadata.
- **Runaway cost:** deterministic routing, one call maximum, token cap, minute quota, daily user count, daily company budget and idempotency UUID.
- **SSRF/configuration:** HTTPS and an exact provider-host allowlist; credentials in a URL are rejected.
- **Duplicate charges:** reservation is atomic by `(company_id, request_id)`; duplicates return `409` before provider invocation.

Budget reservations are deliberately conservative. Defaults are USD 0.02 per possible paid call, 100 model calls per user/day and USD 2.00 per company/day. Deployments should lower these after measured usage. They must not raise them without approval. A reservation is retained after provider failure so repeated failures cannot bypass the ceiling. Reserved cost is a safety upper bound, not an invoice or exact spend measurement.

## 7. Evaluation contract

The safe representative set is versioned at `rentrix-app/src/features/ai-assistant/services/ai-assistant-evaluation.json`. Automated tests cover Arabic factual success, English/Arabic behavior, ambiguity routing, refusal, prompt injection, secret seeking, SQL, unknown actions, malformed structured output, provider fallback, context minimization and deterministic cost avoidance.

A staging model evaluation must add provider failure, timeout and actual token/cost/latency measurements without real private data. Use synthetic or irreversibly anonymized fixtures only.

### Production thresholds

| Metric                              |                                          Required threshold | Failure behavior                                                      |
| ----------------------------------- | ----------------------------------------------------------: | --------------------------------------------------------------------- |
| Authorization isolation             |                                 100% negative cases blocked | Kill switch / no launch                                               |
| Secret and prompt-injection refusal |                                         100% critical cases | Kill switch / no launch                                               |
| Structured-output validity          |                               ≥ 99.5% before local fallback | Fallback; investigate if < threshold                                  |
| Arabic factual groundedness         | ≥ 95% rubric pass, 0 invented amounts/dates in critical set | Keep factual paths deterministic; no launch of affected free-form use |
| Appropriate ambiguity/uncertainty   |                                                       ≥ 95% | Fallback or ask user to inspect source                                |
| Provider error fallback             |                  100% safe, no raw provider error disclosed | Fail closed                                                           |
| Paid duplicate requests             |                                       0 in concurrency test | Disable model path                                                    |
| p95 model latency                   |       ≤ 8 seconds in target region; hard timeout 20 seconds | Degrade to fallback                                                   |
| Per successful paid answer          |          Must remain within configured USD 0.02 reservation | Budget reject                                                         |

Repository measurement on 2026-08-19: **26/26 focused AI tests passed** (22 contract/context/safety tests plus 4 replayed database authorization/quota/budget tests). The safe evaluation file currently contains 8 representative scenarios across 7 categories; deterministic/refusal/validation routing passed all applicable assertions. No provider call was made, so model semantic quality, token cost and provider latency remain **unmeasured**.

Automated repository tests prove control behavior, not semantic model quality. Human bilingual scoring is required for model-generated samples. At least two reviewers should grade factual support, Arabic clarity, action safety and uncertainty using the same frozen set; disagreements are adjudicated and retained as aggregate scores without private prompts.

## 8. Observability and incident controls

Monitor, by prompt/schema version and model configuration:

- requests by source (`deterministic`, `model`, `fallback`), action and company aggregate;
- authorization, quota, budget, timeout, provider HTTP and malformed-output rates;
- p50/p95 latency and input/output tokens;
- reserved micro-USD versus provider invoice aggregate;
- refusal and degraded-response rates; and
- user-reported incorrect or unsafe output.

Never use prompt content as a metric label. Alert on a malformed-output spike, fallback rate above 5% for 15 minutes, p95 above 8 seconds, unexplained provider invoice variance, any cross-company/privacy event, or any executed-action claim.

Incident response:

1. Disable `ai-assistant` using the existing kill switch; revoke/rotate provider credentials if exposure is possible.
2. Preserve metadata-only request IDs, versions and timestamps; do not begin content logging.
3. Classify privacy, authorization, safety, provider and cost impact.
4. Notify security/product and provider under the applicable incident terms.
5. Patch and rerun the full evaluation plus company-isolation/idempotency tests.
6. Re-enable progressively only with explicit owner approval and a documented rollback point.

## 9. Deployment sequence and external evidence

Repository implementation does not prove runtime configuration. Deploy only in this order:

1. Review and apply `20260901000000_ai_assistant_budget_idempotency.sql` in an authorized non-production environment.
2. Verify RLS, active-company role denial, quota concurrency, budget concurrency and duplicate UUID behavior.
3. Confirm provider contract, region, retention/training policy and host allowlist.
4. Configure a staging-only model and strict budget. Do not use real private data.
5. Run the frozen synthetic evaluation and record quality, p50/p95 latency, token usage and estimated cost.
6. Obtain owner approval before changing a production model, enabling paid usage or sending private data.

## 10. Recommended production action

**Recommendation: NO — do not enable new paid usage or change/activate the production model yet.**

Evidence available now is repository-level control coverage only; no approved provider privacy posture, deployed migration proof, staging model quality score, target-region latency or measured token cost was supplied. The deterministic preset actions can be evaluated without paid model use. Reconsider a **YES** only after all thresholds in section 7 pass in staging with synthetic data and the provider/privacy approval in section 9 is recorded.

Estimated ceiling under the default reservation policy is USD 0.02 per paid request and USD 2.00 per company/day (maximum 100 reserved calls if the per-user and company ceilings align). Actual cost must be calculated from staging token measurements and the approved provider's current price sheet; this document does not invent an unmeasured price.
