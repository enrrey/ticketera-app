// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {handleCheckIn} from './checkInApi';
import type {AccessUser} from '@/modules/identity-access';
const actor:AccessUser={id:'operator',clerkUserId:'clerk',email:'operator@example.com',name:'Operator',status:'active',roles:['organizer'],permissions:['tickets.check_in'],overrides:{}};
const request=(origin='http://localhost:3000',body='{"credential":"opaque"}')=>new Request('http://localhost:3000/api/events/event/check-in',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});
it('rejects oversized bodies without consuming a ticket',async()=>{
  const consume=vi.fn();
  const response=await handleCheckIn(request(undefined,' '.repeat(1024*1024+1)),'event',{consume,getMember:async()=>actor});
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({error:'El cuerpo de la solicitud es demasiado grande'});
  expect(consume).not.toHaveBeenCalled();
});
it('rejects foreign origins and unauthenticated or revoked access before consuming',async()=>{
  const consume=vi.fn();const getMember=vi.fn(async()=>actor);
  expect((await handleCheckIn(request('https://other.example'),'event',{consume,getMember})).status).toBe(403);
  expect(getMember).not.toHaveBeenCalled();
  expect((await handleCheckIn(request(),'event',{consume,getMember:async()=>null})).status).toBe(401);
  expect((await handleCheckIn(request(),'event',{consume,getMember:async()=>({...actor,permissions:[]})})).status).toBe(403);
  expect(consume).not.toHaveBeenCalled();
});
it('validates the body, reports duplicate scans and never caches results',async()=>{
  const consume=vi.fn(async()=>({code:'already_used' as const,message:'Ya utilizada'}));
  expect((await handleCheckIn(request(undefined,'{"credential":"x","actorId":"other"}'),'event',{consume,getMember:async()=>actor})).status).toBe(400);
  const response=await handleCheckIn(request(),'event',{consume,getMember:async()=>actor});
  expect(response.status).toBe(409);expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(consume).toHaveBeenCalledWith('operator','event','opaque');
});
