
'use server';
/**
 * @fileOverview A flow to enable or disable a partner's account.
 *
 * - togglePartnerStatus - Updates the disabled status of a user in Firebase Auth and their status in Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';

const TogglePartnerStatusInputSchema = z.object({
  vendorId: z.string().describe('The UID of the partner user.'),
  disabled: z.boolean().describe('The new disabled status for the user account.'),
});
export type TogglePartnerStatusInput = z.infer<typeof TogglePartnerStatusInputSchema>;

export async function togglePartnerStatus(input: TogglePartnerStatusInput): Promise<{ success: boolean; message: string }> {
  return togglePartnerStatusFlow(input);
}

const togglePartnerStatusFlow = ai.defineFlow(
  {
    name: 'togglePartnerStatusFlow',
    inputSchema: TogglePartnerStatusInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ vendorId, disabled }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    try {
        // Update Firebase Authentication
        await admin.auth().updateUser(vendorId, {
            disabled: disabled,
        });

        // Update Firestore document
        const vendorDocRef = db.collection("vendors").doc(vendorId);
        const newStatus = disabled ? "Inactive" : "Active";
        await vendorDocRef.update({ status: newStatus });

        const statusMessage = disabled ? "disabled" : "enabled";
        return { success: true, message: `Partner account has been ${statusMessage}.` };

    } catch (error: any) {
        console.error(`Failed to update status for partner user ${vendorId}:`, error);
        return { success: false, message: `Failed to update status: ${error.message}` };
    }
  }
);
