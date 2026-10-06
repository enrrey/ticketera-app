import { EventsLandingPage } from "@/modules/events";
import { listDatabaseEvents } from "@/modules/events/server";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LoginPage } from "@/modules/portal";

export default async function Home({ searchParams }: { searchParams: Promise<{ __clerk_ticket?: string }> }) {
  if ((await searchParams).__clerk_ticket) return <LoginPage />;
  const events = await listDatabaseEvents("public");
  return (
    <>
      <EventsLandingPage initialEvents={events} />
      <SiteFooter />
    </>
  );
}
