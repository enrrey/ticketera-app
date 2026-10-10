import { sql } from "drizzle-orm";
import {
  pgTable, uuid, text, integer, boolean, timestamp, numeric, jsonb,
  primaryKey, index, uniqueIndex, unique, check, foreignKey,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").defaultRandom().primaryKey();
const time = (name: string) => timestamp(name, { withTimezone: true });
const created = () => time("created_at").defaultNow().notNull();
const currency = () => text("currency").default("pen").notNull();

export const users = pgTable("user", {
  id: id(), clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(), emailVerifiedAt: time("email_verified_at"),
  name: text("name").notNull(), avatarUrl: text("avatar_url"),
  status: text("status").default("active").notNull(),
  identityDisabled: boolean("identity_disabled").default(false).notNull(),
  adminDisabled: boolean("admin_disabled").default(false).notNull(),
  deletedAt: time("deleted_at"),
  identityUpdatedAt: time("identity_updated_at").notNull(),
  createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("user_email_idx").on(t.email), check("user_status_check", sql`${t.status} in ('active', 'inactive')`)]);

export const roles = pgTable("role", {
  id: id(), name: text("name").notNull().unique(),
}, (t) => [check("role_name_check", sql`${t.name} in ('super_admin', 'admin', 'organizer', 'customer')`)]);

export const userRoles = pgTable("user_role", {
  userId: uuid("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id), createdAt: created(),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_role_role_idx").on(t.roleId)]);

export const permissions = pgTable("permission", {
  id: id(), name: text("name").notNull().unique(), description: text("description").notNull(),
});

export const organizerProfiles = pgTable("organizer_profile", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  businessName: text("business_name").notNull(), ruc: text("ruc").notNull(),
  createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [check("organizer_profile_ruc_check", sql`${t.ruc} ~ '^[0-9]{11}$'`)]);

export const rolePermissions = pgTable("role_permission", {
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] }), index("role_permission_permission_idx").on(t.permissionId)]);

export const userPermissions = pgTable("user_permission", {
  userId: uuid("user_id").notNull().references(() => users.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
  allowed: boolean("allowed").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.permissionId] }), index("user_permission_permission_idx").on(t.permissionId)]);

export const superAdminAssignments = pgTable("super_admin_assignment", {
  key: text("key").primaryKey().default("primary"),
  userId: uuid("user_id").notNull().unique().references(() => users.id), createdAt: created(),
}, (t) => [check("super_admin_singleton_check", sql`${t.key} = 'primary'`)]);

export const staffInvitations = pgTable("staff_invitation", {
  id: id(), email: text("email").notNull(), name: text("name").notNull(),
  clerkInvitationId: text("clerk_invitation_id").unique(),
  roles: jsonb("roles").$type<("admin" | "organizer")[]>().notNull(),
  overrides: jsonb("overrides").$type<Record<string, boolean>>().notNull(),
  invitedById: uuid("invited_by_id").notNull().references(() => users.id),
  acceptedById: uuid("accepted_by_id").references(() => users.id),
  status: text("status").default("sending").notNull(),
  expiresAt: time("expires_at").notNull(), acceptedAt: time("accepted_at"), createdAt: created(),
}, (t) => [index("staff_invitation_inviter_idx").on(t.invitedById), index("staff_invitation_acceptor_idx").on(t.acceptedById),
  uniqueIndex("staff_invitation_open_email_idx").on(t.email).where(sql`${t.status} in ('sending', 'pending', 'failed')`),
  check("staff_invitation_status_check", sql`${t.status} in ('sending', 'pending', 'accepted', 'failed', 'expired')`)]);

export const venues = pgTable("venue", {
  id: id(), name: text("name").notNull(), address: text("address").notNull(),
  city: text("city").notNull(), country: text("country").default("PE").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }), googlePlaceId: text("google_place_id"),
}, (t) => [index("venue_city_idx").on(t.city), check("venue_coordinates_check", sql`(${t.latitude} is null and ${t.longitude} is null) or (${t.latitude} is not null and ${t.longitude} is not null and ${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180)`)]);

export const events = pgTable("event", {
  id: id(), slug: text("slug").notNull().unique(), name: text("name").notNull(),
  description: text("description").notNull(), category: text("category").notNull(),
  minimumAge: integer("minimum_age").default(0).notNull(), entryInstructions: text("entry_instructions").default("").notNull(),
  status: text("status").default("draft").notNull(), imageUrl: text("image_url"), featured: boolean("featured").default(false).notNull(),
  seatingLayout: jsonb("seating_layout").$type<{enabled:boolean;template:'stadium'|'theater'|'custom';stagePosition:'north'|'south'}>().default({enabled:false,template:'stadium',stagePosition:'north'}).notNull(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  organizerId: uuid("organizer_id").notNull().references(() => users.id),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("event_venue_idx").on(t.venueId), index("event_organizer_idx").on(t.organizerId), index("event_creator_idx").on(t.createdById), index("event_catalog_idx").on(t.status, t.category), check("event_minimum_age_check",sql`${t.minimumAge} between 0 and 99`), check("event_status_check", sql`${t.status} in ('draft', 'published', 'cancelled', 'completed')`)]);

export const eventSessions = pgTable("event_session", {
  id: id(), eventId: uuid("event_id").notNull().references(() => events.id),
  startsAt: time("starts_at").notNull(), endsAt: time("ends_at").notNull(),
}, (t) => [index("event_session_event_start_idx").on(t.eventId, t.startsAt), unique("event_session_id_event_unique").on(t.id, t.eventId), check("event_session_dates_check", sql`${t.endsAt} > ${t.startsAt}`)]);

export const ticketTypes = pgTable("ticket_type", {
  id: id(), eventId: uuid("event_id").notNull().references(() => events.id),
  name: text("name").notNull(), priceCents: integer("price_cents").notNull(), currency: currency(),
  zone: text("zone").default("General").notNull(), seatingType: text("seating_type").default("standing").notNull(),
  description: text("description").default("").notNull(), maxPerOrder: integer("max_per_order").default(6).notNull(),
  peoplePerUnit: integer("people_per_unit").default(1).notNull(),
  seatRows: jsonb("seat_rows").$type<{ label: string; seats: number }[]>().default([]).notNull(),
  mapPosition: text("map_position").$type<'north'|'south'|'east'|'west'|'center'>().default('west').notNull(),
  capacity: integer("capacity").notNull(), salesStartAt: time("sales_start_at").notNull(),
  salesEndAt: time("sales_end_at").notNull(),
}, (t) => [index("ticket_type_event_idx").on(t.eventId), unique("ticket_type_id_event_unique").on(t.id, t.eventId), check("ticket_type_values_check", sql`${t.priceCents} >= 0 and ${t.capacity} > 0 and ${t.currency} = 'pen'`), check("ticket_type_seating_check",sql`${t.seatingType} in ('standing','seated','numbered','box') and ${t.maxPerOrder} between 1 and 1000 and ${t.peoplePerUnit} between 1 and 50 and (${t.seatingType}='box' or ${t.peoplePerUnit}=1) and jsonb_typeof(${t.seatRows})='array'`), check("ticket_type_dates_check", sql`${t.salesEndAt} > ${t.salesStartAt}`)]);

export const ticketTypeSessions = pgTable("ticket_type_session", {
  ticketTypeId: uuid("ticket_type_id").notNull(), eventSessionId: uuid("event_session_id").notNull(),
  eventId: uuid("event_id").notNull(),
}, (t) => [primaryKey({ columns: [t.ticketTypeId, t.eventSessionId] }), index("ticket_type_session_session_idx").on(t.eventSessionId), foreignKey({ columns: [t.ticketTypeId, t.eventId], foreignColumns: [ticketTypes.id, ticketTypes.eventId] }), foreignKey({ columns: [t.eventSessionId, t.eventId], foreignColumns: [eventSessions.id, eventSessions.eventId] })]);

export const seatHolds = pgTable('seat_hold', {
  id:id(),eventId:uuid('event_id').notNull().references(()=>events.id,{onDelete:'cascade'}),
  ticketTypeId:uuid('ticket_type_id').notNull(),zoneKey:text('zone_key').notNull(),rowKey:text('row_key').notNull(),
  rowLabel:text('row_label').notNull(),seatNumber:integer('seat_number').notNull(),ownerTokenHash:text('owner_token_hash').notNull(),
  createdAt:created(),expiresAt:time('expires_at').default(sql`now() + interval '60 seconds'`).notNull(),
},t=>[foreignKey({columns:[t.ticketTypeId,t.eventId],foreignColumns:[ticketTypes.id,ticketTypes.eventId]}).onDelete('cascade'),
  uniqueIndex('seat_hold_physical_unique').on(t.eventId,t.zoneKey,t.rowKey,t.seatNumber),
  index('seat_hold_owner_idx').on(t.eventId,t.ownerTokenHash),index('seat_hold_expiry_idx').on(t.expiresAt),
  check('seat_hold_values_check',sql`${t.seatNumber} between 1 and 500 and length(${t.rowLabel}) between 1 and 20 and length(${t.ownerTokenHash})=64 and ${t.expiresAt}>${t.createdAt}`)]);

export const promotions = pgTable("promotion", {
  id: id(), eventId: uuid("event_id").notNull().references(() => events.id),
  code: text("code").unique(), name: text("name").notNull(),
  kind: text("kind").notNull(), value: integer("value").notNull(),
  startsAt: time("starts_at").notNull(), endsAt: time("ends_at").notNull(),
  maxRedemptions: integer("max_redemptions"), active: boolean("active").default(true).notNull(),
}, (t) => [index("promotion_event_idx").on(t.eventId), unique("promotion_id_event_unique").on(t.id, t.eventId), check("promotion_values_check", sql`(${t.kind} = 'percentage' and ${t.value} between 1 and 100) or (${t.kind} = 'fixed' and ${t.value} > 0)`), check("promotion_dates_check", sql`${t.endsAt} > ${t.startsAt}`), check("promotion_limit_check", sql`${t.maxRedemptions} is null or ${t.maxRedemptions} > 0`)]);

export const promotionTicketTypes = pgTable("promotion_ticket_type", {
  promotionId: uuid("promotion_id").notNull(), ticketTypeId: uuid("ticket_type_id").notNull(), eventId: uuid("event_id").notNull(),
}, (t) => [primaryKey({ columns: [t.promotionId, t.ticketTypeId] }), index("promotion_ticket_type_type_idx").on(t.ticketTypeId), foreignKey({ columns: [t.promotionId, t.eventId], foreignColumns: [promotions.id, promotions.eventId] }), foreignKey({ columns: [t.ticketTypeId, t.eventId], foreignColumns: [ticketTypes.id, ticketTypes.eventId] })]);

export const orders = pgTable("order", {
  id: id(), userId: uuid("user_id").references(() => users.id),
  buyerEmail: text("buyer_email").notNull(), buyerName: text("buyer_name").notNull(),
  buyerDocumentType: text("buyer_document_type"), buyerDocumentEncrypted: text("buyer_document_encrypted"), buyerPhone: text("buyer_phone"),
  termsVersion: text("terms_version"), termsAcceptedAt: time("terms_accepted_at"),
  status: text("status").default("pending").notNull(), currency: currency(),
  subtotalCents: integer("subtotal_cents").notNull(), discountCents: integer("discount_cents").default(0).notNull(),
  totalCents: integer("total_cents").notNull(), stripeCustomerId: text("stripe_customer_id"),
  accessTokenHash: text("access_token_hash").unique(),
  confirmationTokenHash: text("confirmation_token_hash").unique(),
  createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("order_user_idx").on(t.userId), index("order_guest_email_idx").on(t.buyerEmail).where(sql`${t.userId} is null`), index("order_status_created_idx").on(t.status, t.createdAt), check("order_totals_check", sql`${t.subtotalCents} >= 0 and ${t.discountCents} >= 0 and ${t.discountCents} <= ${t.subtotalCents} and ${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} and ${t.currency} = 'pen'`), check("order_status_check", sql`${t.status} in ('pending', 'paid', 'expired', 'cancelled', 'partially_refunded', 'refunded')`)]);

export const orderItems = pgTable("order_item", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id),
  ticketTypeId: uuid("ticket_type_id").notNull().references(() => ticketTypes.id),
  quantity: integer("quantity").notNull(), unitPriceCents: integer("unit_price_cents").notNull(),
  discountCents: integer("discount_cents").default(0).notNull(), totalCents: integer("total_cents").notNull(),
}, (t) => [index("order_item_order_idx").on(t.orderId), index("order_item_type_idx").on(t.ticketTypeId), check("order_item_totals_check", sql`${t.quantity} > 0 and ${t.unitPriceCents} >= 0 and ${t.discountCents} >= 0 and ${t.discountCents} <= ${t.quantity}::bigint * ${t.unitPriceCents} and ${t.totalCents} = ${t.quantity}::bigint * ${t.unitPriceCents} - ${t.discountCents}`)]);

export const orderPromotions = pgTable("order_promotion", {
  orderId: uuid("order_id").notNull().references(() => orders.id), promotionId: uuid("promotion_id").notNull().references(() => promotions.id),
  discountCents: integer("discount_cents").notNull(),
}, (t) => [primaryKey({ columns: [t.orderId, t.promotionId] }), index("order_promotion_promotion_idx").on(t.promotionId), check("order_promotion_discount_check", sql`${t.discountCents} >= 0`)]);

export const orderItemSeats = pgTable("order_item_seat", {
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  unitNumber: integer("unit_number").notNull(),
  rowLabel: text("row_label").notNull(), seatNumber: integer("seat_number").notNull(),
}, (t) => [primaryKey({ columns: [t.orderItemId, t.unitNumber] }),
  uniqueIndex("order_item_seat_position_unique").on(t.orderItemId, t.rowLabel, t.seatNumber),
  check("order_item_seat_values_check", sql`${t.unitNumber} > 0 and ${t.seatNumber} > 0 and length(trim(${t.rowLabel})) between 1 and 20`)]);

export const inventoryReservations = pgTable("inventory_reservation", {
  id: id(), orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  quantity: integer("quantity").notNull(), status: text("status").default("active").notNull(),
  createdAt: created(), expiresAt: time("expires_at").default(sql`now() + interval '10 minutes'`).notNull(),
}, (t) => [index("reservation_item_idx").on(t.orderItemId), index("reservation_expiry_idx").on(t.status, t.expiresAt), check("reservation_values_check", sql`${t.quantity} > 0 and (${t.expiresAt} = ${t.createdAt} + interval '10 minutes' or ${t.expiresAt} = ${t.createdAt} + interval '15 minutes')`), check("reservation_status_check", sql`${t.status} in ('active', 'converted', 'released')`)]);

export const payments = pgTable("payment", {
  uiMode: text("ui_mode").$type<'hosted'|'elements'>().default('hosted').notNull(),
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(), stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripeChargeId: text("stripe_charge_id").unique(), idempotencyKey: text("idempotency_key").notNull().unique(),
  amountCents: integer("amount_cents").notNull(), currency: currency(), status: text("status").default("pending").notNull(),
  paidAt: time("paid_at"), createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("payment_order_idx").on(t.orderId), index("payment_status_idx").on(t.status), check("payment_amount_check", sql`${t.amountCents} >= 0 and ${t.currency} = 'pen'`), check("payment_status_check", sql`${t.status} in ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded')`)]);

export const tickets = pgTable("ticket", {
  id: id(), orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  unitNumber: integer("unit_number").notNull(), qrTokenHash: text("qr_token_hash").notNull().unique(),
  status: text("status").default("valid").notNull(), attendeeName: text("attendee_name"), attendeeEmail: text("attendee_email"), createdAt: created(),
}, (t) => [uniqueIndex("ticket_item_unit_unique").on(t.orderItemId, t.unitNumber), check("ticket_unit_check", sql`${t.unitNumber} > 0`), check("ticket_status_check", sql`${t.status} in ('valid', 'used', 'refund_pending', 'refunded', 'cancelled')`)]);

export const checkIns = pgTable("check_in", {
  id: id(), ticketId: uuid("ticket_id").notNull().unique().references(() => tickets.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  scannedById: uuid("scanned_by_id").notNull().references(() => users.id), createdAt: created(),
}, (t) => [index("check_in_event_idx").on(t.eventId), index("check_in_scanner_idx").on(t.scannedById)]);

export const refunds = pgTable("refund", {
  id: id(), paymentId: uuid("payment_id").notNull().references(() => payments.id),
  stripeRefundId: text("stripe_refund_id").unique(), idempotencyKey: text("idempotency_key").notNull().unique(),
  amountCents: integer("amount_cents").notNull(), status: text("status").default("pending").notNull(),
  reason: text("reason").notNull(), createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
  attempts: integer("attempts").default(0).notNull(), nextAttemptAt: time("next_attempt_at").defaultNow().notNull(),
}, (t) => [index("refund_payment_idx").on(t.paymentId), index("refund_status_idx").on(t.status), check("refund_amount_check", sql`${t.amountCents} > 0`), check("refund_status_check", sql`${t.status} in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled')`)]);

export const refundTickets = pgTable("refund_ticket", {
  refundId: uuid("refund_id").notNull().references(() => refunds.id), ticketId: uuid("ticket_id").notNull().references(() => tickets.id), amountCents: integer("amount_cents").notNull(),
}, (t) => [primaryKey({ columns: [t.refundId, t.ticketId] }), index("refund_ticket_ticket_idx").on(t.ticketId), check("refund_ticket_amount_check", sql`${t.amountCents} >= 0`)]);

export const stripeAccounts = pgTable("stripe_account", {
  id: id(), userId: uuid("user_id").notNull().unique().references(() => users.id), stripeAccountId: text("stripe_account_id").notNull().unique(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(), chargesEnabled: boolean("charges_enabled").default(false).notNull(), payoutsEnabled: boolean("payouts_enabled").default(false).notNull(),
  createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
});

export const payouts = pgTable("payout", {
  id: id(), organizerId: uuid("organizer_id").notNull().references(() => users.id), eventId: uuid("event_id").notNull().references(() => events.id),
  stripeAccountId: uuid("stripe_account_id").notNull().references(() => stripeAccounts.id),
  initiatedById: uuid("initiated_by_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(), currency: currency(), status: text("status").default("pending").notNull(),
  stripeTransferId: text("stripe_transfer_id").unique(), stripePayoutId: text("stripe_payout_id").unique(), idempotencyKey: text("idempotency_key").notNull().unique(),
  periodStart: time("period_start"), periodEnd: time("period_end"), createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("payout_organizer_idx").on(t.organizerId), index("payout_event_idx").on(t.eventId), index("payout_account_idx").on(t.stripeAccountId), index("payout_initiator_idx").on(t.initiatedById), index("payout_status_idx").on(t.status), check("payout_amount_check", sql`${t.amountCents} > 0 and ${t.currency} = 'pen'`), check("payout_period_check", sql`(${t.periodStart} is null and ${t.periodEnd} is null) or (${t.periodStart} is not null and ${t.periodEnd} is not null and ${t.periodEnd} > ${t.periodStart})`), check("payout_status_check", sql`${t.status} in ('pending', 'processing', 'transferred', 'paid', 'failed', 'cancelled', 'reversed')`)]);

export const invoices = pgTable("invoice", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id), paymentId: uuid("payment_id").references(() => payments.id),
  stripeInvoiceId: text("stripe_invoice_id").notNull().unique(), stripeCustomerId: text("stripe_customer_id").notNull(),
  status: text("status").notNull(), amountCents: integer("amount_cents").notNull(), currency: currency(),
  hostedInvoiceUrl: text("hosted_invoice_url"), invoicePdfUrl: text("invoice_pdf_url"), createdAt: created(), updatedAt: time("updated_at").defaultNow().notNull(),
}, (t) => [index("invoice_order_idx").on(t.orderId), index("invoice_payment_idx").on(t.paymentId), index("invoice_customer_idx").on(t.stripeCustomerId), check("invoice_amount_check", sql`${t.amountCents} >= 0 and ${t.currency} = 'pen'`), check("invoice_status_check", sql`${t.status} in ('draft', 'open', 'paid', 'uncollectible', 'void')`)]);

export const webhookEvents = pgTable("webhook_event", {
  id: id(), provider: text("provider").notNull(), externalEventId: text("external_event_id").notNull(), type: text("type").notNull(),
  status: text("status").default("pending").notNull(), attempts: integer("attempts").default(0).notNull(),
  // Store only the provider object reference; workers retrieve canonical data from Stripe.
  objectId: text("object_id").notNull(), livemode: boolean("livemode").notNull(),
  providerCreatedAt: time("provider_created_at").notNull(), createdAt: created(), processedAt: time("processed_at"),
  nextAttemptAt: time("next_attempt_at").defaultNow().notNull(), claimedAt: time("claimed_at"), claimToken: uuid("claim_token"),
}, (t) => [uniqueIndex("webhook_provider_event_unique").on(t.provider, t.externalEventId), index("webhook_pending_idx").on(t.status, t.createdAt), index("webhook_retry_idx").on(t.provider, t.status, t.nextAttemptAt), check("webhook_provider_check", sql`${t.provider} in ('stripe', 'clerk')`), check("webhook_status_check", sql`${t.status} in ('pending', 'processing', 'processed', 'failed')`), check("webhook_attempts_check", sql`${t.attempts} >= 0`)]);

export const notificationOutbox = pgTable("notification_outbox", {
  id: id(), orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), attempts: integer("attempts").default(0).notNull(),
  encryptedPayload: text("encrypted_payload"), providerMessageId: text("provider_message_id"),
  nextAttemptAt: time("next_attempt_at").defaultNow().notNull(), firstAttemptAt: time("first_attempt_at"),
  claimedAt: time("claimed_at"), claimToken: uuid("claim_token"), sentAt: time("sent_at"), createdAt: created(),
}, (t) => [index("notification_retry_idx").on(t.status,t.nextAttemptAt),
  check("notification_status_check",sql`${t.status} in ('pending','processing','sent','failed','cancelled')`),
  check("notification_attempts_check",sql`${t.attempts} >= 0`)]);

export const auditLogs = pgTable("audit_log", {
  id: id(), actorId: uuid("actor_id").references(() => users.id), action: text("action").notNull(),
  entity: text("entity").notNull(), entityId: uuid("entity_id").notNull(), metadata: jsonb("metadata"), createdAt: created(),
}, (t) => [index("audit_actor_idx").on(t.actorId), index("audit_entity_idx").on(t.entity, t.entityId), index("audit_created_idx").on(t.createdAt)]);
