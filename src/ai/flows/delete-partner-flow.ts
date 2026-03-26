
'use server';
/**
 * @fileOverview A flow to completely delete a partner/vendor.
 *
 * - deletePartner - Deletes a user from Firebase Auth and their data from Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';

const DeletePartnerInputSchema = z.object({
  partnerId: z.string().describe('The UID of the partner user to delete.'),
});
export type DeletePartnerInput = z.infer<typeof DeletePartnerInputSchema>;

export async function deletePartner(input: DeletePartnerInput): Promise<{ success: boolean; message: string }> {
  return deletePartnerFlow(input);
}

const deletePartnerFlow = ai.defineFlow(
  {
    name: 'deletePartnerFlow',
    inputSchema: DeletePartnerInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ partnerId }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    try {
        // Delete from Firebase Authentication
        await admin.auth().deleteUser(partnerId);
        
        // Delete from Firestore
        const vendorDocRef = db.collection("vendors").doc(partnerId);
        await vendorDocRef.delete();

        return { success: true, message: "Partner and authentication record deleted successfully." };

    } catch (error: any) {
        console.error(`Failed to delete partner ${partnerId}:`, error);
        
        // If user is not found in Auth, but we still want to clean up Firestore
        if (error.code === 'auth/user-not-found') {
            const vendorDocRef = db.collection("vendors").doc(partnerId);
            await vendorDocRef.delete();
            return { success: true, message: "User not found in Auth, but Firestore record cleaned up." };
        }
        
        return { success: false, message: `Failed to delete partner: ${error.message}` };
    }
  }
);
