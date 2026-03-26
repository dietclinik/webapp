
'use server';
/**
 * @fileOverview A flow to completely delete a customer.
 *
 * - deleteCustomer - Deletes a user from Firebase Auth and their data from Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';

const DeleteCustomerInputSchema = z.object({
  userId: z.string().describe('The UID of the user to delete.'),
});
export type DeleteCustomerInput = z.infer<typeof DeleteCustomerInputSchema>;

export async function deleteCustomer(input: DeleteCustomerInput): Promise<{ success: boolean; message: string }> {
  return deleteCustomerFlow(input);
}

const deleteCustomerFlow = ai.defineFlow(
  {
    name: 'deleteCustomerFlow',
    inputSchema: DeleteCustomerInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ userId }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    try {
        // Delete from Firebase Authentication
        await admin.auth().deleteUser(userId);
        
        // Delete from Firestore
        const customerDocRef = db.collection("customers").doc(userId);
        const profileDocRef = db.collection("userProfiles").doc(userId);
        // We could also delete subscription history here if needed.

        const batch = db.batch();
        batch.delete(customerDocRef);
        batch.delete(profileDocRef);
        await batch.commit();

        return { success: true, message: "Customer and authentication record deleted successfully." };

    } catch (error: any) {
        console.error(`Failed to delete user ${userId}:`, error);
        
        // If user is not found in Auth, but we still want to clean up Firestore
        if (error.code === 'auth/user-not-found') {
            const customerDocRef = db.collection("customers").doc(userId);
            const profileDocRef = db.collection("userProfiles").doc(userId);
            const batch = db.batch();
            batch.delete(customerDocRef);
            batch.delete(profileDocRef);
            await batch.commit();
            return { success: true, message: "User not found in Auth, but Firestore records cleaned up." };
        }
        
        return { success: false, message: `Failed to delete customer: ${error.message}` };
    }
  }
);
