import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublishedEvent } from "@/modules/events/server";
import { EventPurchaseExperience } from "@/modules/events/components/EventPurchaseExperience";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getPublishedEvent(eventId);
  if (!event) notFound();

  return <><EventPurchaseExperience event={event} /><SiteFooter /></>;
}
