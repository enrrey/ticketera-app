import type { Event } from "../types";

// Official listings checked on 2026-09-28. Inventory and prices stay with the seller.
const listings = [
  { id: "zayn", title: "Zayn", tour: "The Konnakol Tour", genre: "Pop", date: "2026-10-14", venue: "Costa 21", city: "Lima", featured: true, heroImageUrl: "/images/events/zayn-hero.jpg", ticketUrl: "https://teleticket.com.pe/zayn" },
  { id: "mana", title: "Maná", tour: "Vivir sin aire Tour", genre: "Rock", date: "2026-12-02", venue: "Estadio San Marcos", city: "Lima", featured: true, ticketUrl: "https://teleticket.com.pe/mana-2026" },
  { id: "airbag", title: "Airbag", tour: "El club de la pelea II", genre: "Rock", date: "2026-11-14", venue: "Estadio San Marcos", city: "Lima", featured: true, ticketUrl: "https://teleticket.com.pe/airbag-2026" },
  { id: "camilo", title: "Camilo", tour: "En concierto", genre: "Pop", date: "2026-11-10", venue: "Costa 21", city: "Lima", featured: true, ticketUrl: "https://teleticket.com.pe/camilo-2026" },
  { id: "cultura", title: "Cultura Profética", tour: "En vivo Tour 2026", genre: "Reggae", date: "2026-10-08", venue: "Costa 21", city: "Lima", featured: false, heroImageUrl: "/images/events/cultura-hero.jpg", ticketUrl: "https://teleticket.com.pe/cultura-profetica-lima-2026" },
  { id: "hombres-g", title: "Hombres G", tour: "Dos noches para volver a cantar", genre: "Rock", date: "2026-10-29", endDate: "2026-10-30", venue: "Estadio Nacional", city: "Lima", featured: false, ticketUrl: "https://teleticket.com.pe/hombres-g-lima-2026" },
  { id: "festival", title: "Reggaetón Lima Festival 7", tour: "Un estadio. Todo el ritmo.", genre: "Urbano", date: "2026-10-31", venue: "Estadio Nacional", city: "Lima", featured: false, heroImageUrl: "/images/events/festival-hero.jpg", ticketUrl: "https://teleticket.com.pe/reggaeton-lima-festival-2026" },
  { id: "camilo-arequipa", title: "Camilo en Arequipa", tour: "En concierto", genre: "Pop", date: "2026-11-08", venue: "Jardín de la Cerveza", city: "Arequipa", featured: false, ticketUrl: "https://teleticket.com.pe/camilo-2026-aqp" },
  { id: "airbag-arequipa", title: "Airbag en Arequipa", tour: "El club de la pelea II", genre: "Rock", date: "2026-11-12", venue: "Arena Arequipa", city: "Arequipa", featured: false, ticketUrl: "https://teleticket.com.pe/airbag-arequipa-2026" },
  { id: "hardwell", title: "Hardwell", tour: "South America World Tour", genre: "Electrónica", date: "2026-11-13", venue: "Costa 21", city: "Lima", featured: false, ticketUrl: "https://teleticket.com.pe/hardwell" },
  { id: "hayley", title: "Hayley Williams", tour: "The Hayley Williams Show", genre: "Rock", date: "2026-11-21", venue: "Costa 21", city: "Lima", featured: false, ticketUrl: "https://teleticket.com.pe/hayley-williams" },
  { id: "ca7riel", title: "CA7RIEL & Paco Amoroso", tour: "Free Spirits World Tour", genre: "Urbano", date: "2026-11-27", venue: "Costa 21", city: "Lima", featured: false, ticketUrl: "https://teleticket.com.pe/ca7riel-y-paco" },
  { id: "daniela", title: "Daniela Darcourt", tour: "Una noche diferente", genre: "Salsa", date: "2026-11-27", venue: "Auditorio del Pentagonito", city: "Lima", featured: false, ticketUrl: "https://teleticket.com.pe/una-noche-diferente-daniela-darcourt" },
  { id: "kapo", title: "Kapo en Arequipa", tour: "En concierto", genre: "Urbano", date: "2026-12-05", venue: "Jardín de la Cerveza", city: "Arequipa", featured: false, ticketUrl: "https://teleticket.com.pe/kapo-arequipa" },
];

const events: Event[] = listings.map((event) => ({
  ...event,
  category: event.id === "festival" ? "festival" : "concert",
  imageUrl: `/images/events/${event.id}.jpg`,
  price: null,
  currency: "PEN",
  verifiedAt: "2026-09-28",
}));

export async function getEvents(): Promise<Event[]> {
  return events;
}
