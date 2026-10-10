import {requirePagePermission} from '@/modules/identity-access';
import {ManagementShell} from '@/modules/identity-access/client';
import {QrCheckInPage} from '@/modules/tickets';
import {listCheckInEvents} from '@/modules/tickets/server';
export const dynamic='force-dynamic';
export default async function Page(){
  const actor=await requirePagePermission('tickets.check_in','/validar-entradas');
  const events=await listCheckInEvents(actor.id);
  return <ManagementShell><div className="p-5 md:p-8"><QrCheckInPage events={events}/></div></ManagementShell>;
}
