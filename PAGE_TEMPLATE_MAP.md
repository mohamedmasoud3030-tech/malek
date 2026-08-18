# PAGE_TEMPLATE_MAP

## Templates

| Template | Use for | Regions |
|---|---|---|
| T-Overview | /dashboard | Hero, setup, work queues, optional analytics last |
| T-Index | Registers | Header+primary CTA, filters, EntityTable, pagination |
| T-Detail | Dossiers | Header actions, summary, sections, related lists |
| T-Form | Create/edit | Header, EntityForm sections, sticky actions |
| T-Hub | /financials, portfolio sections | Tabs + embedded T-Index/T-Detail |
| T-Settings | /settings/* | Section nav + forms/lists |
| T-Auth | login/recovery | Centered narrow form |
| T-Report | /reports | Filter bar + panels (table/chart) |
| T-Admin | audit/integrity/system | Dense tables, no decorative KPIs |

## Route → template

| Route family | Template |
|---|---|
| /dashboard | T-Overview |
| /properties, /owners, /contracts, /tenants, /people, /leads, /communication, /maintenance, /service-providers, /lands | T-Index (or T-Hub child) |
| /$entity/$id | T-Detail |
| /new, /edit | T-Form |
| /financials?* | T-Hub |
| /reports | T-Report |
| /settings, /automation | T-Settings |
| /login, recovery | T-Auth |
| /audit-log, /data-integrity, /system | T-Admin |
| /ai-assistant | Custom conversation (justified) |

Do not force AI or reports into T-Index.
