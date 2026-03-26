
'use server';
/**
 * @fileOverview A flow to create notifications in Firestore.
 *
 * - createNotification - Creates a notification document for a user or admin.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const CreateNotificationInputSchema = z.object({
  userId: z.string().describe("The UID of the user to notify, or 'admin' for admin notifications."),
  message: z.string().describe('The content of the notification message.'),
  link: z.string().optional().describe('A URL link for the notification.'),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;

export async function createNotification(input: CreateNotificationInput): Promise<{ success: boolean; id?: string }> {
  return createNotificationFlow(input);
}

const createNotificationFlow = ai.defineFlow(
  {
    name: 'createNotificationFlow',
    inputSchema: CreateNotificationInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  },
  async ({ userId, message, link }) => {
    if (!db) {
      console.error("Firestore not available. Skipping notification.");
      return { success: false };
    }

    try {
      const notificationData = {
        userId,
        message,
        link: link || '#',
        timestamp: Timestamp.now(),
        read: false,
      };
      
      const docRef = await db.collection('notifications').add(notificationData);
      console.log(`Notification created for ${userId} with ID: ${docRef.id}`);
      return { success: true, id: docRef.id };

    } catch (error) {
      console.error(`Failed to create notification for ${userId}:`, error);
      return { success: false };
    }
  }
);
