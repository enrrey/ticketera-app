import {requirePagePermission} from '@/modules/identity-access';
import {ManagementShell} from '@/modules/identity-access/client';
import {ReportingDashboard} from '@/modules/reporting';
import {getDashboardMetrics} from '@/modules/reporting/server';
export const dynamic='force-dynamic';
export default async function Page(){const actor=await requirePagePermission('events.manage','/organizador/metricas');return <ManagementShell><ReportingDashboard metrics={await getDashboardMetrics(actor.id)}/></ManagementShell>;}
