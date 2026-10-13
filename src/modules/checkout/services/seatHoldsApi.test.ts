// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { handleSeatHolds } from './seatHolds';
import { getDatabase } from '@/lib/db';
vi.mock('@/lib/db',()=>({getDatabase:vi.fn(()=>{throw new Error('Unexpected database access');})}));
it('rejects oversized seat selections before touching the database',async()=>{
  const response=await handleSeatHolds(new Request('https://app.test/api/checkout/seats/event',{
    method:'PUT',headers:{origin:'https://app.test'},body:' '.repeat(1024*1024+1),
  }),'event');
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({error:'El cuerpo de la solicitud es demasiado grande',code:'body_too_large'});
  expect(getDatabase).not.toHaveBeenCalled();
});
it('preserves invalid JSON responses',async()=>{
  const response=await handleSeatHolds(new Request('https://app.test/api/checkout/seats/event',{
    method:'PUT',headers:{origin:'https://app.test'},body:'{invalid',
  }),'event');
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({code:'invalid_seats'});
});
