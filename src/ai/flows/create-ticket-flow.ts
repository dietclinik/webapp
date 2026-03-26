
'use server';
/**
 * @fileOverview A flow to create a support ticket in Firestore.
 *
 * - createTicket - Creates a support ticket document for a user and notifies admin.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';

const CreateTicketInputSchema = z.object({
  userId: z.string().describe("The UID of the user creating the ticket."),
  customerName: z.string().describe("The name of the customer."),
  subject: z.string().min(5).describe('The subject of the support ticket.'),
  description: z.string().min(10).describe('A detailed description of the issue.'),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export async function createTicket(input: CreateTicketInput): Promise<{ success: boolean; id?: string }> {
  return createTicketFlow(input);
}

const createTicketFlow = ai.defineFlow(
  {
    name: 'createTicketFlow',
    inputSchema: CreateTicketInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  },
  async ({ userId, customerName, subject, description }) => {
    if (!db) {
      console.error("Firestore not available. Skipping ticket creation.");
      return { success: false };
    }

    try {
      const ticketData = {
        userId,
        customerName,
        subject,
        description,
        status: 'Open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await db.collection('supportTickets').add(ticketData);
      
      await createNotification({
          userId: 'admin',
          message: `New support ticket from ${customerName}: "${subject}"`,
          link: `/admin/support`
      });

      return { success: true, id: docRef.id };

    } catch (error) {
      console.error(`Failed to create ticket for ${userId}:`, error);
      return { success: false };
    }
  }
);
