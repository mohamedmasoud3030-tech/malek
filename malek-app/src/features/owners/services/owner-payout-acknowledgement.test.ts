import {beforeEach,expect,it,vi} from 'vitest';
import {processOwnerPayout} from './owner-settlements-service';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:mock}));
const payload={settlement_id:'settlement-1',request_id:'attempt-1',payout_method:'cash' as const,payout_reference:'bank-ref',payment_quote:{settlement_id:'settlement-1',status:'APPROVED' as const,net_payable:1000,offset_applied:20.125,effective_payable:979.875,quote:'a'.repeat(64)}};
const ack={success:true,status:'PAID',settlement_id:'settlement-1',net_payable:1000,offset_applied:20.125,effective_payable:979.875,request_id:'attempt-1',journal_batch_id:'batch-1'};
beforeEach(()=>vi.clearAllMocks());
it('does not treat an empty acknowledgement as a completed payout',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:null});
 await expect(processOwnerPayout(payload)).rejects.toThrow();
});
it('uses the caller attempt identity and quoted source on every retry',async()=>{
 mock.rpc.mockResolvedValue({data:ack,error:null});
 await processOwnerPayout(payload);await processOwnerPayout(payload);
 expect(mock.rpc).toHaveBeenCalledTimes(2);
 for(const call of mock.rpc.mock.calls)expect(call).toEqual(['pay_owner_settlement_atomic',{p_payload:{settlement_id:'settlement-1',request_id:'attempt-1',method:'cash',payment_reference:'bank-ref',expected_quote:'a'.repeat(64)}}]);
});
it.each([{settlement_id:'other'},{effective_payable:1000},{offset_applied:0},{request_id:'other'},{journal_batch_id:null}])('rejects an unrelated or inconsistent paid acknowledgement %j',async patch=>{
 mock.rpc.mockResolvedValue({data:{...ack,...patch},error:null});
 await expect(processOwnerPayout(payload)).rejects.toThrow();
});
it('accepts a fully offset acknowledgement without inventing a cash batch',async()=>{
 const p={...payload,payment_quote:{...payload.payment_quote,offset_applied:1000,effective_payable:0}};
 mock.rpc.mockResolvedValue({data:{...ack,offset_applied:1000,effective_payable:0,journal_batch_id:null},error:null});
 await expect(processOwnerPayout(p)).resolves.toBeUndefined();
});
