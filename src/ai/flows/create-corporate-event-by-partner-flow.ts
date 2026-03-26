
'use server';
/**
 * @fileOverview A flow for a corporate partner to create their own event.
 *
 * - createCorporateEventByPartner - Creates an event and saves it to Firestore under the partner's ID.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';
import { format } from 'date-fns';

const CreateEventInputSchema = z.object({
  title: z.string().describe('The title of the event.'),
  description: z.string().optional().describe('The description or details for the event.'),
  venue: z.string().describe('The location of the event.'),
  eventTime: z.string().describe('The date and time of the event.'),
  registrationCloseDate: z.string().describe('The closing date for event registrations.'),
  participants: z.coerce.number().describe('The expected number of participants.'),
});

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

const CreateEventByPartnerInputSchema = CreateEventInputSchema.extend({
    corporateId: z.string(),
});
export type CreateEventByPartnerInput = z.infer<typeof CreateEventByPartnerInputSchema>;


export async function createCorporateEventByPartner(input: CreateEventByPartnerInput): Promise<{ success: boolean; message: string; eventId?: string; }> {
  return createCorporateEventFlow(input);
}

const createCorporateEventFlow = ai.defineFlow(
  {
    name: 'createCorporateEventByPartnerFlow',
    inputSchema: CreateEventByPartnerInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        eventId: z.string().optional(),
    }),
  },
  async (input) => {
    
    if (!db) {
        console.error("Firestore not available. Skipping event creation.");
        return { success: false, message: "Database not configured." };
    }
    
    if (!input.corporateId) {
        return { success: false, message: "User is not authenticated." };
    }

    const corporateDoc = await db.collection('corporates').doc(input.corporateId).get();
    if (!corporateDoc.exists) {
        return { success: false, message: "Corporate account not found." };
    }
    const corporateData = corporateDoc.data()!;
    const corporateName = corporateData.name || 'A Corporate Partner';
    const planId = corporateData.planId;

    if (planId) {
        const planDoc = await db.collection('subscriptionPlans').doc(planId).get();
        if (planDoc.exists) {
            const maxCustomers = planDoc.data()?.maxCustomers;
            if (maxCustomers && input.participants > maxCustomers) {
                return { success: false, message: `Participant limit exceeded. Your plan allows a maximum of ${maxCustomers} participants.` };
            }
        }
    }


    const eventData = {
        title: input.title,
        description: input.description || '',
        venue: input.venue,
        eventTime: Timestamp.fromDate(new Date(input.eventTime)),
        registrationCloseDate: Timestamp.fromDate(new Date(input.registrationCloseDate)),
        participants: input.participants,
        corporateId: input.corporateId,
        corporateName: corporateName,
        createdAt: Timestamp.now(),
        status: 'Upcoming',
    };

    const docRef = await db.collection('corporateEvents').add(eventData);

    await createNotification({
        userId: 'admin',
        message: `${corporateName} has scheduled a new event: "${input.title}".`,
        link: `/admin/corporates` 
    });

    const successMsg = `Successfully created event "${input.title}".`;
    console.log(successMsg);
    return { success: true, message: successMsg, eventId: docRef.id };
  }
);
