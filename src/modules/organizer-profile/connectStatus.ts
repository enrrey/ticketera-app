import {and,eq} from 'drizzle-orm';
import {getDatabase} from '@/lib/db';
import {stripeAccounts} from '@/lib/db/schema';
import {getStripeClient} from '@/modules/payments/server';
import {readOrganizerProfile} from './profileService';
/** Existing connected accounts are checked against Stripe; profile data never implies verification. */
export async function readConnectStatus(userId:string){
  const db=getDatabase();await readOrganizerProfile(userId,db);
  const [record]=await db.select().from(stripeAccounts).where(eq(stripeAccounts.userId,userId));
  if(!record)return {available:false};
  const account=await getStripeClient().accounts.retrieve(record.stripeAccountId);
  if(account.id!==record.stripeAccountId)throw new Error('Account mismatch');
  const status={available:true,chargesEnabled:account.charges_enabled,payoutsEnabled:account.payouts_enabled,detailsSubmitted:account.details_submitted};
  await db.update(stripeAccounts).set({chargesEnabled:status.chargesEnabled,payoutsEnabled:status.payoutsEnabled,onboardingComplete:status.detailsSubmitted,updatedAt:new Date()}).where(and(eq(stripeAccounts.id,record.id),eq(stripeAccounts.userId,userId),eq(stripeAccounts.stripeAccountId,account.id)));
  return status;
}
