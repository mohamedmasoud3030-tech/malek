import { beforeEach, expect, it, vi } from 'vitest';
import { listSuggestedBankMatches } from './bankReconciliationService';
const mocks=vi.hoisted(()=>({rows:[] as {id:string;paid_at:string}[],rpc:vi.fn(),eq:vi.fn(),gte:vi.fn(),lte:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc:mocks.rpc,from:(table:string)=>{
  const q:Record<string,any>={};
  for(const method of ['select','is','order','returns','in'])q[method]=()=>q;
  for(const method of ['gte','lte'] as const)q[method]=(...args:unknown[])=>{mocks[method](...args);return q;};
  q.eq=(...args:unknown[])=>{mocks.eq(...args);return q;};
  q.range=async(start:number,end:number)=>({data:table==='owner_settlements'?mocks.rows.slice(start,end+1):[],error:null});
  return q;
}}}));
vi.mock('@/lib/supabase-error',()=>({handleSupabaseError:vi.fn()}));
const suggest=()=>listSuggestedBankMatches({amount:-975,transaction_date:'2026-09-09'},'Asia/Muscat');
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.rows=[{id:'paid-1',paid_at:'2026-09-08T21:30:00Z'}];
  mocks.rpc.mockImplementation(async(_name:string,{p_settlement_ids}: {p_settlement_ids:string[]})=>({data:p_settlement_ids.map(id=>({settlement_id:id,cash_paid:975})),error:null}));
});
it('suggests posted residual cash on the company date without filtering by entitlement',async()=>{
  expect(await suggest()).toEqual([{entity_type:'owner_payout',entity_id:'paid-1',amount:-975,date:'2026-09-09',label:'صرف تسوية مالك paid-1'}]);
  expect(mocks.rpc).toHaveBeenCalledWith('get_owner_settlement_cash_payments',{p_settlement_ids:['paid-1']});
  expect(mocks.eq).not.toHaveBeenCalledWith('net_payable',expect.anything());
  expect(mocks.gte).toHaveBeenCalledWith('paid_at','2026-09-08T00:00:00.000Z');
  expect(mocks.lte).toHaveBeenCalledWith('paid_at','2026-09-11T00:00:00.000Z');
});
it('does not suggest a different cash amount or a proven no-cash closure',async()=>{
  for(const cash_paid of [1000,0]){
    mocks.rpc.mockResolvedValueOnce({data:[{settlement_id:'paid-1',cash_paid}],error:null});
    expect(await suggest()).toEqual([]);
  }
});
it('does not request cash for another company-calendar day',async()=>{
  mocks.rows=[{id:'previous-day',paid_at:'2026-09-08T10:00:00Z'}];
  expect(await suggest()).toEqual([]);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('batches all matching-date identities without truncation',async()=>{
  mocks.rows=Array.from({length:205},(_,i)=>({id:`paid-${i}`,paid_at:'2026-09-09T10:00:00Z'}));
  expect(await suggest()).toHaveLength(205);
  expect(mocks.rpc.mock.calls.map(call=>call[1].p_settlement_ids.length)).toEqual([200,5]);
});
it.each([
  ['missing',[]],
  ['wrong identity',[{settlement_id:'foreign',cash_paid:975}]],
  ['duplicate',[{settlement_id:'paid-1',cash_paid:975},{settlement_id:'paid-1',cash_paid:975}]],
  ['unknown cash',[{settlement_id:'paid-1',cash_paid:null}]],
  ['invalid cash',[{settlement_id:'paid-1',cash_paid:-975}]],
])('fails closed on %s evidence rather than returning partial suggestions',async(_label,data)=>{
  mocks.rpc.mockResolvedValueOnce({data,error:null});await expect(suggest()).rejects.toThrow();
});
it('propagates a later cash batch failure without returning the first batch',async()=>{
  mocks.rows=Array.from({length:205},(_,i)=>({id:`paid-${i}`,paid_at:'2026-09-09T10:00:00Z'}));
  mocks.rpc.mockImplementationOnce(async(_name:string,{p_settlement_ids}: {p_settlement_ids:string[]})=>({data:p_settlement_ids.map(id=>({settlement_id:id,cash_paid:975})),error:null}));
  mocks.rpc.mockResolvedValueOnce({data:null,error:new Error('Cash evidence unavailable')});
  await expect(suggest()).rejects.toThrow('Cash evidence unavailable');
});
