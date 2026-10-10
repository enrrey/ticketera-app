// @vitest-environment node
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {eq} from 'drizzle-orm';
import {orders} from '@/lib/db/schema';
import {createTestDatabase,ids} from './testDatabase';
import {createCheckout} from './createCheckout';
import {getCheckout} from './getCheckout';
import {publicCheckoutSchema} from './checkoutSchema';
import {encryptBuyerDocument} from './buyerIdentity';
let fixture:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{vi.stubEnv('QR_SIGNING_SECRET','a'.repeat(64));fixture=await createTestDatabase();},60_000);
afterAll(async()=>{await fixture.pg.close();vi.unstubAllEnvs();});
it('stores accepted terms and encrypted identity without exposing buyer identity in the order response',async()=>{
  const input=publicCheckoutSchema.parse({eventId:'main-event',buyer:{name:'Ana',email:'ana@example.com',documentType:'dni',documentNumber:'12345678',phone:'999123456'},acceptedTerms:true,termsVersion:'2026-10-09',items:[{ticketTypeId:ids.general,quantity:1}]});
  const result=await createCheckout(input,null,fixture.db);
  const [stored]=await fixture.db.select().from(orders).where(eq(orders.id,result.orderId));
  expect(stored.buyerDocumentEncrypted).toMatch(/^v1\./);expect(stored.buyerDocumentEncrypted).not.toContain('12345678');
  expect(stored).toMatchObject({buyerDocumentType:'dni',buyerPhone:'999123456',termsVersion:'2026-10-09'});expect(stored.termsAcceptedAt).toBeInstanceOf(Date);
  const summary=await getCheckout(result.orderId,{userId:null,token:result.accessToken!},fixture.db);
  expect(JSON.stringify(summary)).not.toContain('12345678');expect(JSON.stringify(summary)).not.toContain('999123456');
});
it('uses a fresh nonce for repeated documents',()=>{expect(encryptBuyerDocument('12345678')).not.toEqual(encryptBuyerDocument('12345678'));});
