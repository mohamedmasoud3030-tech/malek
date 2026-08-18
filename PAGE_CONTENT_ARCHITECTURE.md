# PAGE_CONTENT_ARCHITECTURE

> Matrix of what each major surface must display. Patterns chosen from operator tasks, not aesthetics.

## Legend

- **Pattern:** Overview | Index(EntityTable) | Detail | Form | Settings | Auth | Hub(tabs)
- **Mobile:** shared EntityTable card = identity + one primary datum + actions menu

## Auth & public

| Route | Goal | Role | Primary question | Required content | Primary action | Pattern | Mobile | Desktop | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| /login | Authenticate | anon | Can I enter my office? | Email, password, brand, support | تسجيل الدخول | Auth form | single column | single column | Env/config errors block submit; no account enumeration |
| /forgot-password | Start recovery | anon | How do I reset? | Email, neutral success | إرسال الرابط | Auth form | single | single | Neutral copy |
| /dashboard | Prioritize work | all | What needs me now? | Onboarding (if incomplete), work queues, honest KPIs | Open queue item | Overview | stack | stack+grid | No fake zeros on error |

## Portfolio

| Route | Goal | Role | Primary question | Required | Supporting | Primary action | Secondary | Pattern | Mobile | Desktop |
|---|---|---|---|---|---|---|---|---|---|---|
| /properties | Find a property | ops | Which asset? | Title, status, occupancy signal, owner summary | Address, type | Open detail / Add property | Filters, export | Index EntityTable | card: title+status | dense table |
| /properties/$id | Operate one asset | ops | What is the state of this asset? | Identity, units summary, owners, agreements, open issues | Docs, history | Add unit / edit | Navigate related | Detail dossier | tabs or section stack (single body) | multi-section |
| /owners | Find owner | owners.hub | Who is the owner and load? | Name, contact, property count, **active contracts** | Ownership % rows | Open preview/detail | Relationships, edit | Index EntityTable | card: name+contracts | compare columns |
| /owners/$id | Owner dossier | owners.detail | What do we owe / manage for them? | Identity, properties, settlements entry, agreements | Financial RPCs | Edit / settlements | Docs | Detail | stack | 2-col groups |
| /lands | Land register | lands.view | Which land parcel? | Identifier, status, owner link | Area, notes | Open / add | — | Index | card | table |

## Leasing

| Route | Goal | Required | Primary action | Pattern | Mobile datum |
|---|---|---|---|---|---|
| /contracts | Manage lease lifecycle | Ref, parties, unit, status, dates, rent | New contract / open | Index EntityTable | status or end date |
| /contracts/$id | Act on one lease | Lifecycle controls, parties, money summary, evidence | Approve/sign/activate (perm) | Detail dossier | sections |
| /tenants | Find tenant | Name, phone, active contracts | Open dossier | Index | contracts |
| /people | Party directory | Name, type, contact | Add person | Index | type |
| /leads | Convert demand | Name, status, source | Advance/archive | Index | status |
| /communication | Log outreach | Subject, party, date, status | Add note | Index | date |

## Money

| Route | Goal | Required | Primary action | Destructive | Pattern | Mobile datum |
|---|---|---|---|---|---|---|
| /financials hub | Choose money task | Section tabs by permission | Open view | — | Hub | tabs scroll |
| invoices | What is due? | Tenant/property, amount, due, status | Collect / open | void via process | Index+detail | amount |
| receipts | What was collected? | Amount, method, date, links | Open / void request | void maker-checker | Index+detail | amount |
| arrears | Who is late? | Aging, amount, party | Follow up | — | Index | amount |
| expenses | What did we spend? | Property, category, amount, date, charged_to | Create expense | — | Index+form | amount |
| deposits | Tenant deposit liability | Balance, tenant, status | Claim/refund flows | reverse | Workspace table | balance |
| owner-settlements | Pay owners safely | Period, totals, sources, approval | Create/approve/pay | cancel | Workspace table | total |
| bank-reconciliation | Match bank truth | Line desc, **amount**, date, status | Match/ignore/import | ignore | Index+forms | **amount** |
| commissions | Broker payables | Source, amount, status | Approve/pay | reverse | Index | amount |

## Services

| Route | Goal | Required | Primary action | Pattern | Mobile datum |
|---|---|---|---|---|---|
| maintenance | Clear work orders | Title, property/unit, status, priority | Create / transition | Index | status |
| service-providers | Pick vendor | Name, categories, contact | Add / open | ListPage Index | categories |
| utilities | Meter & bill ops | Meter id, readings, bill amount/status | Create meter/bill | Index dual | amount/status |
| documents vault | Find file | Title, entity link, date | Upload | Index | date |

## Reports & settings

| Route | Goal | Pattern | Notes |
|---|---|---|---|
| /reports | Decide from statements | Report sections; tables for drill; charts only when trend needed | Keep separate from Money hub (PRD-007) |
| /settings | Configure office | Settings sections | Not daily ops |
| /ai-assistant | Ask read-only | Conversation | No posting authority |
| audit/integrity/system | Govern | Tables | Admin |

## Universal required states (all data pages)

Loading (skeleton/table skeleton) · Empty (first-use CTA) · No-results (filter) · Error (retry, not empty) · Permission denied · Offline banner (shell).
