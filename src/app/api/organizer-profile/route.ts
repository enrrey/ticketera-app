import {handleOrganizerProfile} from '@/modules/organizer-profile';
import {readConnectStatus} from '@/modules/organizer-profile/connectStatus';
export async function GET(request:Request){return handleOrganizerProfile(request,readConnectStatus);}
export async function PUT(request:Request){return handleOrganizerProfile(request,readConnectStatus);}
