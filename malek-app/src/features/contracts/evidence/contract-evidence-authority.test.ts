import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const C1='ce000000-0000-4000-8000-000000000001'; const C2='ce000000-0000-4000-8000-000000000002';
const MAKER='ce000000-0000-4000-8000-000000000011'; const CHECKER='ce000000-0000-4000-8000-000000000012'; const OTHER='ce000000-0000-4000-8000-000000000013';
const OWNER='ce000000-0000-4000-8000-000000000021'; const PROPERTY='ce000000-0000-4000-8000-000000000031'; const UNIT='ce000000-0000-4000-8000-000000000041'; const TENANT='ce000000-0000-4000-8000-000000000051'; const CONTRACT='ce000000-0000-4000-8000-000000000061'; const DOC='ce000000-0000-4000-8000-000000000071';
let db:PGlite;
async function rpc(sql:string){const r=await db.query<{r:any}>(sql);return r.rows[0]?.r;}
const fullChecklist=`(select jsonb_agg(jsonb_build_object('code',x->>'code','condition','GOOD','note','تم الفحص')) from public.contract_inspection_templates t cross join lateral jsonb_array_elements(t.checklist_definition) x where t.code='SYSTEM_MOVE_IN' limit 1)`;

describe('contract registration and handover evidence authority',()=>{
  beforeAll(async()=>{
    const replay=await createFullReplayedDatabase({writeEvidence:false}); expect(replay.failed).toEqual([]); db=replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values ('${C1}','Evidence A','evidence-a'),('${C2}','Evidence B','evidence-b');
      insert into auth.users(id,email) values ('${MAKER}','maker@evidence.test'),('${CHECKER}','checker@evidence.test'),('${OTHER}','other@evidence.test');
      insert into public.users(id,email,name,role,status,is_active) values
       ('${MAKER}','maker@evidence.test','Maker','MANAGER','ACTIVE',true),
       ('${CHECKER}','checker@evidence.test','Checker','MANAGER','ACTIVE',true),
       ('${OTHER}','other@evidence.test','Other','ADMIN','ACTIVE',true);
      insert into public.company_members(company_id,user_id,role) values ('${C1}','${MAKER}','ADMIN'),('${C1}','${CHECKER}','ADMIN'),('${C2}','${OTHER}','ADMIN');
      insert into public.owners(id,full_name,name,company_id) values ('${OWNER}','Owner','Owner','${C1}');
      insert into public.properties(id,title,name,type,address,company_id) values ('${PROPERTY}','Evidence Property','Evidence Property','residential','Sohar','${C1}');
      insert into public.property_owners(property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values ('${PROPERTY}','${OWNER}',100,true,date '2025-01-01',null,'${C1}');
      insert into public.owner_agreements(id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values ('ce000000-0000-4000-8000-000000000081','${OWNER}','${PROPERTY}','property_management','RATE',5,date '2025-01-01',null,'${C1}');
      insert into public.owner_agreement_versions(id,owner_agreement_id,company_id,version_no,operating_model,collection_role,commission_type,commission_value,commission_recognition_basis,deposit_beneficiary,effective_from)
       values('ce000000-0000-4000-8000-000000000082','ce000000-0000-4000-8000-000000000081','${C1}',1,'OWNER_AGENCY','OWNER_IS_CREDITOR','RATE',5,'ON_COLLECTION','OWNER',date '2025-01-01');
      update public.owner_agreements set current_version_id='ce000000-0000-4000-8000-000000000082' where id='ce000000-0000-4000-8000-000000000081';
      insert into public.units(id,property_id,name,unit_number,company_id) values ('${UNIT}','${PROPERTY}','Unit','1','${C1}');
      insert into public.people(id,full_name,type,company_id) values ('${TENANT}','Tenant','tenant','${C1}');
      insert into public.contracts(id,property_id,unit_id,tenant_id,agreement_id,agreement_version_id,collection_role_snapshot,operating_model_snapshot,start_date,end_date,rent_amount,payment_cycle,status,company_id)
       values ('${CONTRACT}','${PROPERTY}','${UNIT}','${TENANT}','ce000000-0000-4000-8000-000000000081','ce000000-0000-4000-8000-000000000082','OWNER_IS_CREDITOR','OWNER_AGENCY',date '2026-01-01',date '2026-12-31',500,'monthly','active','${C1}');
      insert into public.vault_documents(id,title,category,related_entity_type,related_entity_id,file_name,file_url,storage_path,company_id)
       values ('${DOC}','Registration proof','contracts','contract','${CONTRACT}','proof.pdf','private','contracts/proof.pdf','${C1}');
    `);
  },420000);
  afterAll(async()=>{await db?.close();});

  it('fails closed when legal registration configuration is absent',async()=>{
    await assumeIdentity(db,MAKER,C1);
    const state=await rpc(`select public.get_contract_evidence_state('${CONTRACT}') r`);
    expect(state.registration_configuration_status).toBe('NOT_CONFIGURED');
    await expect(rpc(`select public.submit_contract_registration_atomic('{"contract_id":"${CONTRACT}","submitted_on":"2026-08-17","request_id":"reg:no-profile"}') r`)).rejects.toThrow(/NOT_CONFIGURED/);
  });

  it('snapshots an approved profile and enforces maker-checker verification with contract evidence',async()=>{
    await db.exec(`insert into public.contract_registration_requirement_profiles(company_id,jurisdiction_code,authority_name,registration_required,deadline_days,fee_mode,legal_reference,effective_from,approved_by_label,approved_at)
      values('${C1}','OM-TEST','Approved test authority',true,30,'EXTERNAL','TEST-ONLY-LEGAL-REF',date '2025-01-01','Test legal reviewer',now())`);
    await assumeIdentity(db,MAKER,C1);
    const submitted=await rpc(`select public.submit_contract_registration_atomic('{"contract_id":"${CONTRACT}","submitted_on":"2026-08-17","external_request_reference":"EXT-1","request_id":"reg:submit"}') r`);
    expect(submitted.status).toBe('SUBMITTED'); expect(submitted.authority_name_snapshot).toBe('Approved test authority');
    await expect(rpc(`select public.decide_contract_registration_atomic(jsonb_build_object('registration_id','${submitted.id}','action','REGISTER','registration_reference','REG-1','registered_on','2026-08-18','evidence_document_id','${DOC}','request_id','reg:self')) r`)).rejects.toThrow(/VERIFY_FORBIDDEN|SELF_VERIFICATION/);
    await assumeIdentity(db,CHECKER,C1);
    const registered=await rpc(`select public.decide_contract_registration_atomic(jsonb_build_object('registration_id','${submitted.id}','action','REGISTER','registration_reference','REG-1','registered_on','2026-08-18','evidence_document_id','${DOC}','request_id','reg:verify')) r`);
    expect(registered.status).toBe('REGISTERED'); expect(registered.registration_reference).toBe('REG-1');
  });

  it('creates a draft inspection but rejects completion with missing required items',async()=>{
    await assumeIdentity(db,MAKER,C1);
    const template=(await db.query<{id:string}>(`select id::text id from public.contract_inspection_templates where code='SYSTEM_MOVE_IN'`)).rows[0].id;
    const draft=await rpc(`select public.save_contract_inspection_draft_atomic(jsonb_build_object('contract_id','${CONTRACT}','template_id','${template}','kind','MOVE_IN','inspected_on','2026-08-17','checklist','[]'::jsonb,'evidence_document_ids',jsonb_build_array('${DOC}'),'request_id','inspection:draft')) r`);
    expect(draft.status).toBe('DRAFT');
    await expect(rpc(`select public.complete_contract_inspection_atomic(jsonb_build_object('inspection_id','${draft.id}','tenant_signature','Tenant','office_signature','Office','request_id','inspection:bad-complete')) r`)).rejects.toThrow(/REQUIRED_ITEMS_INCOMPLETE/);
  });

  it('completes all required evidence, rejects self-review and allows a distinct manager review',async()=>{
    await assumeIdentity(db,MAKER,C1);
    const draft=(await db.query<{id:string;template_id:string}>(`select id::text id,template_id::text from public.contract_inspections where contract_id='${CONTRACT}' and kind='MOVE_IN'`)).rows[0];
    const saved=await rpc(`select public.save_contract_inspection_draft_atomic(jsonb_build_object('inspection_id','${draft.id}','contract_id','${CONTRACT}','template_id','${draft.template_id}','kind','MOVE_IN','inspected_on','2026-08-17','checklist',${fullChecklist},'meter_readings',jsonb_build_object('electricity','100','water','20'),'keys_and_access',jsonb_build_object('key_count',2),'evidence_document_ids',jsonb_build_array('${DOC}'),'request_id','inspection:complete-draft')) r`);
    const completed=await rpc(`select public.complete_contract_inspection_atomic(jsonb_build_object('inspection_id','${saved.id}','tenant_signature','Tenant signed','office_signature','Office signed','request_id','inspection:complete')) r`);
    expect(completed.status).toBe('COMPLETED');
    await expect(rpc(`select public.review_contract_inspection_atomic(jsonb_build_object('inspection_id','${saved.id}','action','APPROVE','request_id','inspection:self-review')) r`)).rejects.toThrow(/SELF_REVIEW/);
    await assumeIdentity(db,CHECKER,C1);
    const reviewed=await rpc(`select public.review_contract_inspection_atomic(jsonb_build_object('inspection_id','${saved.id}','action','APPROVE','request_id','inspection:review')) r`);
    expect(reviewed.status).toBe('REVIEWED');
    const events=await db.query<{n:number}>(`select count(*)::int n from public.contract_evidence_events where contract_id='${CONTRACT}'`); expect(events.rows[0].n).toBeGreaterThanOrEqual(5);
  });

  it('requires a reviewed move-out inspection for every new damage deposit claim',async()=>{
    const moveOutTemplate=(await db.query<{id:string;definition:any}>(`select id::text id,checklist_definition definition from public.contract_inspection_templates where code='SYSTEM_MOVE_OUT'`)).rows[0];
    await db.exec(`
      insert into public.contract_inspections(id,company_id,contract_id,template_id,template_snapshot,kind,status,inspected_on,checklist,tenant_signature,office_signature,completion_request_id,review_request_id,created_by,completed_by,reviewed_by,completed_at,reviewed_at,request_id)
      values('ce000000-0000-4000-8000-000000000091','${C1}','${CONTRACT}','${moveOutTemplate.id}',jsonb_build_object('checklist_definition','${JSON.stringify(moveOutTemplate.definition).replaceAll("'","''")}'::jsonb),'MOVE_OUT','REVIEWED',date '2026-08-17','[]'::jsonb,'Tenant','Office','moveout:complete','moveout:review','${MAKER}','${MAKER}','${CHECKER}',now(),now(),'moveout:draft');
      insert into public.tenant_deposits(id,contract_id,tenant_id,property_id,unit_id,deposit_amount,remaining_amount,status,received_date,company_id,request_id)
      values('ce000000-0000-4000-8000-000000000092','${CONTRACT}','${TENANT}','${PROPERTY}','${UNIT}',200,200,'held',date '2026-01-01','${C1}','deposit:evidence');
    `);
    await assumeIdentity(db,MAKER,C1);
    await expect(rpc(`select public.create_deposit_application_claim_with_inspection_atomic(jsonb_build_object('deposit_id','ce000000-0000-4000-8000-000000000092','claim_kind','DAMAGE','allocation_amount',50,'evidence_uri','evidence://damage','request_id','damage:no-inspection')) r`)).rejects.toThrow(/INSPECTION_REQUIRED/);
    const claim=await rpc(`select public.create_deposit_application_claim_with_inspection_atomic(jsonb_build_object('deposit_id','ce000000-0000-4000-8000-000000000092','claim_kind','DAMAGE','allocation_amount',50,'evidence_uri','evidence://damage','inspection_id','ce000000-0000-4000-8000-000000000091','request_id','damage:reviewed')) r`);
    const linked=await db.query<{inspection_id:string}>(`select inspection_id::text from public.deposit_application_claims where id='${claim.claim_id}'`);
    expect(linked.rows[0].inspection_id).toBe('ce000000-0000-4000-8000-000000000091');
  });

  it('blocks cross-company enumeration through the read model',async()=>{
    await assumeIdentity(db,OTHER,C2);
    await expect(rpc(`select public.get_contract_evidence_state('${CONTRACT}') r`)).rejects.toThrow(/CONTRACT_NOT_FOUND/);
  });
});
