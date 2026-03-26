
'use server';
/**
 * @fileOverview A flow to log a customer's daily weight.
 *
 * - logDailyWeight - Saves the weight log and notifies relevant staff/admin.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';

const LogDailyWeightInputSchema = z.object({
  userId: z.string().describe("The UID of the user logging their weight."),
  weight: z.number().describe('The weight in kilograms.'),
});

export type LogDailyWeightInput = z.infer<typeof LogDailyWeightInputSchema>;

export async function logDailyWeight(input: LogDailyWeightInput): Promise<{ success: boolean; id?: string }> {
  return logDailyWeightFlow(input);
}

const logDailyWeightFlow = ai.defineFlow(
  {
    name: 'logDailyWeightFlow',
    inputSchema: LogDailyWeightInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  },
  async ({ userId, weight }) => {
    if (!db) {
      console.error("Firestore not available. Skipping weight log.");
      return { success: false };
    }

    try {
      const weightLogData = {
        userId,
        weight,
        date: Timestamp.now(),
      };
      
      const docRef = await db.collection('dailyWeightLogs').add(weightLogData);
      console.log(`Weight log created for ${userId} with ID: ${docRef.id}`);

      // Fetch customer data to get name and assigned staff
      const customerDoc = await db.collection('customers').doc(userId).get();
      if(customerDoc.exists()) {
        const customerData = customerDoc.data();
        const customerName = customerData?.name || 'A customer';

        const notificationPromises = [];
        notificationPromises.push(createNotification({
            userId: 'admin',
            message: `${customerName} logged a new weight: ${weight} kg.`,
            link: `/admin/customers/view/${userId}`
        }));
        
        if (customerData?.assignedStaffId) {
             notificationPromises.push(createNotification({
                userId: customerData.assignedStaffId,
                message: `${customerName} logged a new weight: ${weight} kg.`,
                link: `/staff/my-customers/view/${userId}`
            }));
        }
        await Promise.all(notificationPromises);
      }

      return { success: true, id: docRef.id };

    } catch (error) {
      console.error(`Failed to create weight log for ${userId}:`, error);
      return { success: false };
    }
  }
);
