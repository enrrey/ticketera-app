import { MyTicketsPage } from "@/modules/portal";
import { requirePagePermission } from "@/modules/identity-access";

export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const user=await requirePagePermission('tickets.read_own','/mis-entradas');
  const value=(await searchParams).page??'1';
  return <MyTicketsPage userId={user.id} page={/^[1-9][0-9]{0,5}$/.test(value)?Number(value):1}/>;
}
