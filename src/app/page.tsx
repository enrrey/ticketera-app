import { EventsLandingPage, getEvents } from "@/modules/events";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default async function Home() {
  const events = await getEvents();
  return (
    <>
      <EventsLandingPage initialEvents={events} />
      <SiteFooter />
    </>
  );
}
