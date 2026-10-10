import { requirePagePermission } from '@/modules/identity-access';
import { PurchasesPage } from '@/modules/portal';
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const user=await requirePagePermission('tickets.read_own','/mis-compras');
  const value=(await searchParams).page??'1';
  const page=/^[1-9][0-9]{0,5}$/.test(value)?Number(value):1;
  return <PurchasesPage userId={user.id} page={page}/>;
}
