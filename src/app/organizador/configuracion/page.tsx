import {requirePagePermission} from '@/modules/identity-access';
import {OrganizerProfilePage} from '@/modules/organizer-profile';
export const dynamic='force-dynamic';
export default async function Page(){await requirePagePermission('events.manage','/organizador/configuracion');return <OrganizerProfilePage/>;}
