export type OrganizerProfileInput = { businessName: string; ruc: string };
export type ConnectStatus = { available: boolean; chargesEnabled?: boolean; payoutsEnabled?: boolean; detailsSubmitted?: boolean };
export type OrganizerProfile = OrganizerProfileInput & { updatedAt: string | null; connect: ConnectStatus };
