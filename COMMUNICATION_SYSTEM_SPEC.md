# MALEK Communication System Specification

**Status:** repository-side safety foundation and preview contract; not proof of live external delivery  
**Date:** 2026-08-20  
**Canonical rules:** PRD-001, PRD-009, SEC-002, SEC-003, SEC-005, SEC-010, UX-001, UX-005, UX-008  
**Owners:** Product Operations (event policy/copy), Platform (delivery), Security (privacy/incident), Finance (financial-event approval)

## 1. Product decision

MALEK justifies two communication modes today:

1. **In-app notifications** for authenticated staff who must act inside MALEK. This is the only active delivery channel.
2. **Local email/WhatsApp preview** for a small set of expected tenant/owner communications. Preview requires recorded consent and human review and performs no external handoff or send.

SMS is not justified while WhatsApp/email cover the expected external use cases and no delivery/cost evidence exists. Web push is not justified because urgent operational work already appears in the authenticated in-app queue and the product has no approved push consent, device-token or lock-screen privacy model. Product marketing/broadcast messaging is outside scope.

No live provider, webhook, email sender, WhatsApp API, SMS account, push subscription or paid plan is connected by this change.

## 2. Repository inventory and reality

| Layer                    | Current repository reality and disposition                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-app feed              | `NotificationsMenu` combines authoritative dashboard counts, permission review work and recipient-scoped `app_notifications`. It is active. Persisted copy/link values are now validated again at the UI boundary.                                                                                 |
| Permission triggers      | Permission request/decision RPCs create recipient-scoped `app_notifications`. Generic copy replaces user-entered reasons in notification previews.                                                                                                                                                 |
| Automation notifications | Existing scheduled/manual automation creates internal `automation_notifications`. Forward hardening replaces entity IDs/amounts with generic copy and restricts table access to ADMIN/MANAGER.                                                                                                     |
| Operational aggregation  | Overdue invoices, expiring contracts and urgent maintenance are counts from the server dashboard snapshot, not one message per row. This remains the anti-spam default.                                                                                                                            |
| Communication records    | `communication_records` is a manually maintained interaction log (phone, WhatsApp, email, meeting, note). Saving a record does not send anything.                                                                                                                                                  |
| Outbound UI              | Communication Center previously built `wa.me`/`mailto` URLs. It now produces an on-page local preview only; no recipient or message enters a URL. Contract/receipt WhatsApp URL actions and the unused URL helper were removed; generic native share/copy contains no record identifier or amount. |
| Automation dispatch      | Provider-neutral builders exist and do not send. Legacy previews previously rendered names/amounts into URLs; previews now ignore dispatch variables and external links are disabled.                                                                                                              |
| Templates                | Canonical versioned Arabic/English templates are in `communication-system.ts`; compatibility IDs map existing UI choices to these templates. Templates are generic and contain no names, amounts, account details or record IDs.                                                                   |
| Providers                | `PreviewCommunicationAdapter` is the only adapter. Email/WhatsApp are preview-only; SMS/push are disabled. No provider SDK or secret is present.                                                                                                                                                   |
| Jobs/retries             | Historical automation cron creates internal notifications. No external delivery worker exists. Retry policy is defined/tested but cannot become active until an approved live adapter and queueing migration exist.                                                                                |
| Preferences              | New company/user/event/channel preferences enforce locale, consent posture and quiet hours. Mandatory transactional in-app events cannot be disabled.                                                                                                                                              |
| Delivery ledger          | New metadata-only outbox stores event/channel/template version/source/idempotency/status/attempt/cost metadata. It stores no destination, subject, body or provider payload. Current preparation emits only `PREVIEW` or `SUPPRESSED`.                                                             |
| Delivery logs            | No content logs. Provider references must be hashed if a future provider is approved. Safe error codes only.                                                                                                                                                                                       |
| Unsubscribe              | Optional external channels require an enabled preference and consent. Mandatory transactional in-app events are not unsubscribable. No one-click external unsubscribe link exists because no external channel is live.                                                                             |
| Costs                    | Current external cost is zero. Every preview reservation stores zero micro-USD. No paid usage can be reached from current code.                                                                                                                                                                    |

The historical `notification_templates`, `notifications` and `outgoing_notifications` tables are legacy schema, not the new delivery authority. They are not wired to a live provider and must not be repurposed without a governed migration.

## 3. Event–channel matrix

| Event                     | Class / priority              |          In-app |            Email |         WhatsApp | Dedupe / rate  | Notes                                                                           |
| ------------------------- | ----------------------------- | --------------: | ---------------: | ---------------: | -------------- | ------------------------------------------------------------------------------- |
| Access decision           | Transactional / HIGH          |        Required |               No |               No | 24h; max 5/day | Recipient sees generic status and reviews permissions inside MALEK.             |
| Support status changed    | Transactional / NORMAL        |        Required |               No |               No | 1h; max 10/day | No support description in preview.                                              |
| Receipt/collection posted | Transactional / HIGH          |        Required | Optional preview | Optional preview | 7d; max 3/day  | External requires consent + human verification; no amount/reference in preview. |
| Payment result uncertain  | Transactional / CRITICAL      |        Required |               No |               No | 24h; max 5/day | Staff only: explicitly says do not repeat the operation. Quiet hours bypassed.  |
| Contract approaching end  | Optional operational / NORMAL | Digest/optional | Optional preview | Optional preview | 7d; max 1/day  | Staff reviews contract before any tenant communication.                         |
| Rent due reminder         | Optional operational / NORMAL | No separate row | Optional preview | Optional preview | 72h; max 1/day | External only after consent/review; no amount or unit in lock-screen copy.      |
| Overdue follow-up         | Optional operational / HIGH   |      Aggregated | Optional preview | Optional preview | 7d; max 1/day  | Human review is mandatory due financial/legal sensitivity.                      |
| Urgent maintenance        | Transactional / HIGH          |        Required |               No |               No | 24h; max 5/day | Staff follows the authorized maintenance route.                                 |
| Owner statement ready     | Optional operational / NORMAL |        Optional | Optional preview |               No | 28d; max 1/day | Preview is not the statement; attachment/send requires later approval.          |

Not justified: invoice-created noise, every non-urgent maintenance update, every status transition, product tips, promotional campaigns, all-user broadcasts, duplicate row-level reminders when an aggregate is sufficient, and external escalation merely because a user is currently active in the app.

## 4. Transactional vs optional and preferences

Transactional messages protect access, integrity, payment ambiguity or urgent operations. Required in-app instances cannot be disabled. Optional operational events may be disabled per user, event and channel.

External preview requires all of:

- event/channel allowed by the matrix;
- valid recipient shape;
- preference enabled;
- documented consent confirmed by the operator;
- human review for every currently justified external event;
- outside quiet hours; and
- daily rate and idempotency checks passing.

Default locale is Arabic. English is available only through a complete versioned template, never automatic translation. Default timezone is `Asia/Muscat`; quiet hours are 21:00–08:00. Transactional urgent in-app events bypass quiet hours because they are visible only when the user opens MALEK. External previews do not bypass quiet hours.

## 5. Template and copy rules

1. Every template key is `event.channel.locale` with an integer version.
2. Arabic and English variants must be committed and tested together.
3. Notification/subject/lock-screen copy contains no person name, phone, email, amount, unit/property, invoice/receipt number, account number, UUID, document text or free-form reason.
4. No secrets, passwords, tokens, recovery links, authorization headers or provider errors.
5. No rendered message or recipient in a URL. `wa.me` and `mailto` handoffs are prohibited in preview mode.
6. Deep links are relative, canonical, generic workspace links. They contain no record identifier. The destination re-authorizes before showing data.
7. Financial copy never states that a payment succeeded unless the authoritative posted record exists. Ambiguous results instruct the operator not to retry.
8. Templates cannot accept arbitrary variables in preview mode. Full details stay inside the authorized product screen/document.
9. Right-to-left presentation is explicit for Arabic and left-to-right for English. Dynamic preview uses `aria-live` and a visible “not sent” state.
10. User-entered reasons and communication-record bodies are never reused as notification copy.

## 6. Delivery lifecycle and provider boundary

Lifecycle vocabulary:

`PREVIEW | SUPPRESSED | QUEUED | SENDING | SENT | DELIVERED | FAILED | DEAD | CANCELLED`

Current code can create only `PREVIEW` or `SUPPRESSED`; therefore no repository path can charge or send. `QUEUED` and later states are reserved for a future approved server worker.

Provider interface:

```text
CommunicationProviderAdapter
  id
  mode: preview | live
  prepare(validated request) -> validated result
```

Provider SDKs, credentials, request envelopes and callbacks must remain behind a server-side adapter. Browser code may never hold provider secrets or call a live provider. A future adapter must map provider responses to stable failure classes and hash provider references before persistence.

## 7. Idempotency, spam prevention and scheduling

- Caller supplies a UUID idempotency key for one logical recipient/event/channel occurrence.
- Database uniqueness is `(company, recipient, channel, idempotency_key)` under an advisory lock.
- A duplicate returns the existing delivery record and creates no second reservation.
- Per-event daily ceilings are enforced before preparation.
- Row-heavy operational conditions use dashboard aggregates rather than individual bell entries.
- Event-specific windows range from one hour (support status) to 28 days (owner statement).
- Quiet-hour evaluation uses the stored `Asia/Muscat` timezone.
- No scheduler may fan out an external event without preference, consent and human-review evidence.
- Contradictory messages are prevented by deriving send eligibility from authoritative state at preparation time; stale snapshots must suppress rather than send.

## 8. Failure and retry rules

Only `NETWORK`, `RATE_LIMIT` and provider `SERVER` failures are transient:

1. retry after 60 seconds;
2. retry after 5 minutes;
3. retry after 30 minutes;
4. then mark `DEAD` and alert an operator in-app.

`AUTH`, `INVALID_RECIPIENT` and provider `REJECTED` are permanent and receive no automatic retry. A retry reuses the same delivery/idempotency record; it never creates a new charge. A future worker must claim rows atomically, use a lease, and reconcile provider callbacks idempotently.

Current preview mode has no provider failure or retry execution. The rules are pure/tested policy, not a claim of deployed delivery.

## 9. Privacy and authorization

- Company, actor and recipient membership are re-derived at the SECURITY DEFINER boundary.
- Only ADMIN/MANAGER may prepare communication previews for another company member.
- Preference updates are self-service and company-scoped.
- Delivery tables deny direct authenticated access; approved RPCs are the boundary.
- Automation notifications are restricted to ADMIN/MANAGER after forward hardening.
- Delivery metadata excludes destination, rendered body/subject and provider payload.
- Routine logs may contain delivery ID, event, channel, template version, status, latency, attempt and safe error code only.
- UI sanitizes persisted notification preview text and rejects external/identifier-bearing links even after database validation.
- Lock-screen/push is disabled. If approved later, push payload must be only “يوجد تحديث داخل MALEK” and the app must re-fetch after authorization.

## 10. Monitoring and cost controls

Monitor metadata only:

- prepared, suppressed, queued, sent, delivered, failed and dead counts by event/channel/template version;
- duplicate and daily-rate suppression;
- preference/consent/review/quiet-hour suppression;
- p50/p95 provider latency, safe failure class and attempt count;
- delivery-to-provider-invoice reconciliation; and
- unsubscribe/complaint rate when an external channel exists.

Alert on any cross-company denial, content/address appearing in logs, duplicate `SENT`, unexpected non-zero reserved cost in preview mode, delivery after preference disable, or callback without a known delivery ID.

Cost defaults are fail-closed: preview cost is USD 0; SMS/push/email/WhatsApp live capability is disabled; no paid adapter exists. A future activation needs an explicit per-company daily budget and per-channel unit-cost ceiling before the first live queue record.

## 11. Tests and acceptance

Repository tests cover:

- event/channel policy and disabled SMS/push;
- complete Arabic/English template coverage;
- generic copy with no unresolved variables, identifiers or contact details;
- consent, human review, preference and quiet-hour enforcement;
- bounded transient retry and permanent-failure refusal;
- authenticated authority, active-company recipient isolation and preference invariants;
- one-time preparation and duplicate replay;
- metadata-only, zero-cost delivery reservation;
- legacy app/automation notification sanitization;
- no WhatsApp/mailto URL and no arbitrary variable dump;
- Arabic/English direction and accessible local-preview status; and
- migration replay, typecheck and build.

Still external: live provider contract/privacy/region, real callback signatures, sender-domain/WhatsApp registration, unsubscribe end-to-end, target-region latency, carrier filtering, cost and hosted browser/device acceptance.

## 12. Incident and rollout controls

If a future live channel misbehaves:

1. disable the channel/provider kill switch and stop claiming queue rows;
2. preserve metadata-only delivery IDs and attempt history;
3. cancel queued optional messages and prevent retries;
4. rotate provider credentials if exposure is suspected;
5. identify duplicates, wrong recipients, cross-company exposure and financial contradiction;
6. notify Security/Product/Finance as applicable;
7. patch, replay the frozen tests and validate with synthetic recipients; and
8. re-enable progressively only with owner approval.

No migration may silently convert existing `PREVIEW` records to `QUEUED`.

## 13. Live-provider recommendation and one approval question

A live provider is **not activated**. When owner approval is available, the recommended first provider evaluation is **Postmark for transactional email only**, because email receipts/status communications are expected, Postmark separates transactional message streams and documents delivery, bounce and complaint webhooks. This is simpler and lower-risk than activating WhatsApp, SMS and push together. WhatsApp, SMS and push should remain disabled until separate evidence justifies them.

The [official pricing page](https://postmarkapp.com/pricing), checked 2026-08-20, lists Basic from **USD 15/month for 10,000 emails** plus overage, with some retention controls as paid add-ons. This is an estimate for evaluation only, not approval to purchase; pricing, data region, DPA, retention and webhook authentication must be rechecked at decision time. Provider behavior references: [Message Streams](https://postmarkapp.com/message-streams) and [webhooks](https://postmarkapp.com/developer/webhooks/webhooks-overview).

**Yes or no: approve a Postmark staging evaluation using synthetic addresses only, with a hard zero-production-recipient rule and no live MALEK traffic?**
