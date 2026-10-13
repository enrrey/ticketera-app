import {z} from 'zod';
import {isSameOrigin} from '@/lib/sameOrigin';
import {readRequestJson,RequestBodyTooLargeError} from '@/lib/requestBody';
import {AccessError,getCurrentAccessUser} from '@/modules/identity-access';
import {checkInTicket} from './checkIn';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
const input=z.object({credential:z.string().trim().min(1).max(200)}).strict();
export async function handleCheckIn(request:Request,slug:string,dependencies:{getMember?:typeof getCurrentAccessUser;consume?:typeof checkInTicket}={}){
  if(!isSameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403,headers});
  try{
    const member=await(dependencies.getMember??getCurrentAccessUser)();
    if(!member)return Response.json({error:'Debes iniciar sesión'},{status:401,headers});
    if(member.status!=='active'||!member.permissions.includes('tickets.check_in'))return Response.json({error:'No tienes permiso para validar entradas'},{status:403,headers});
    const body=input.parse(await readRequestJson(request));
    const result=await(dependencies.consume??checkInTicket)(member.id,slug,body.credential);
    return Response.json(result,{status:result.code==='accepted'?200:409,headers});
  }catch(error){
    if(error instanceof RequestBodyTooLargeError)return Response.json({error:error.message},{status:413,headers});
    const invalid=error instanceof z.ZodError||error instanceof SyntaxError;
    return Response.json({error:error instanceof AccessError?error.message:invalid?'Código inválido':'No pudimos validar la entrada. Reintenta para confirmar el resultado.'},{status:error instanceof AccessError?error.status:invalid?400:503,headers});
  }
}
