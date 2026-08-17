import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const COMPANY='a1000000-0000-4000-8000-000000000001';
const USER='a1000000-0000-4000-8000-000000000011';
const DISABLED='a1000000-0000-4000-8000-000000000012';
let db:PGlite;

describe('AI assistant distributed quota',()=>{
  beforeAll(async()=>{
    const replay=await createFullReplayedDatabase({writeEvidence:false}); expect(replay.failed).toEqual([]); db=replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values('${COMPANY}','AI Quota','ai-quota');
      insert into auth.users(id,email) values('${USER}','ai@test.invalid'),('${DISABLED}','disabled-ai@test.invalid');
      insert into public.users(id,email,name,role,status,is_active) values
       ('${USER}','ai@test.invalid','AI User','USER','ACTIVE',true),
       ('${DISABLED}','disabled-ai@test.invalid','Disabled','USER','INACTIVE',false);
      insert into public.company_members(company_id,user_id,role) values
       ('${COMPANY}','${USER}','ADMIN'),('${COMPANY}','${DISABLED}','ADMIN');
    `);
  },420000);
  afterAll(async()=>{await db?.close();});

  it('allows only the configured count across repeated calls in the same database window',async()=>{
    await assumeIdentity(db,USER,COMPANY);
    for(let i=1;i<=3;i+=1){
      const {rows}=await db.query<{r:{allowed:boolean;remaining:number}}>(`select public.consume_ai_assistant_quota_atomic(60,3) r`);
      expect(rows[0].r.allowed).toBe(true);
      expect(rows[0].r.remaining).toBe(3-i);
    }
    const {rows}=await db.query<{r:{allowed:boolean;retry_after:number}}>(`select public.consume_ai_assistant_quota_atomic(60,3) r`);
    expect(rows[0].r.allowed).toBe(false); expect(rows[0].r.retry_after).toBeGreaterThan(0);
  });

  it('fails closed for an inactive application user',async()=>{
    await assumeIdentity(db,DISABLED,COMPANY);
    await expect(db.query(`select public.consume_ai_assistant_quota_atomic(60,10)`)).rejects.toThrow(/ACTIVE_COMPANY_MEMBERSHIP_REQUIRED/);
  });
});
