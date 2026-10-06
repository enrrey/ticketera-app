import { getEvents } from "@/modules/events/services/eventsService";
import { MyTicketsPage } from "@/modules/portal/components/PortalPages";
import { requirePagePermission } from "@/modules/identity-access";

export default async function Page() { await requirePagePermission("tickets.read_own"); return <MyTicketsPage events={await getEvents()} />; }
