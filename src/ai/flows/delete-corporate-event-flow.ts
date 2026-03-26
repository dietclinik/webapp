
'use server';
/**
 * @fileOverview A flow for deleting a corporate event.
 *
 * - deleteCorporateEvent - Deletes an event document from Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';

const DeleteEventInputSchema = z.object({
  eventId: z.string().describe('The ID of the event to delete.'),
});

export async function deleteCorporateEvent(input: z.infer<typeof DeleteEventInputSchema>): Promise<{ success: boolean; message: string; }> {
  return deleteCorporateEventFlow(input);
}

const deleteCorporateEventFlow = ai.defineFlow(
  {
    name: 'deleteCorporateEventFlow',
    inputSchema: DeleteEventInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
    }),
  },
  async ({ eventId }) => {
    
    if (!db) {
        console.error("Firestore not available. Skipping event deletion.");
        return { success: false, message: "Database not configured." };
    }
    
    try {
        const eventDocRef = db.collection('corporateEvents').doc(eventId);
        await eventDocRef.delete();
        
        // Note: In a production app, you might also want to delete subcollections
        // like registrations, which requires a more complex recursive delete function.
        // For now, we are just deleting the main event document.
        
        return { success: true, message: "Event successfully deleted." };
    } catch (error: any) {
        console.error(`Failed to delete event ${eventId}:`, error);
        return { success: false, message: `Failed to delete event: ${error.message}` };
    }
  }
);
