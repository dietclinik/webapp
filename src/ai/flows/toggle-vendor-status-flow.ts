
'use server';
/**
 * @fileOverview A flow to enable or disable a vendor's account.
 *
 * - toggleVendorStatus - Updates the disabled status of a user in Firebase Auth and their status in Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';

const ToggleVendorStatusInputSchema = z.object({
  vendorId: z.string().describe('The UID of the vendor user.'),
  disabled: z.boolean().describe('The new disabled status for the user account.'),
});
export type ToggleVendorStatusInput = z.infer<typeof ToggleVendorStatusInputSchema>;

export async function toggleVendorStatus(input: ToggleVendorStatusInput): Promise<{ success: boolean; message: string }> {
  return toggleVendorStatusFlow(input);
}

const toggleVendorStatusFlow = ai.defineFlow(
  {
    name: 'toggleVendorStatusFlow',
    inputSchema: ToggleVendorStatusInputSchema,
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
        return { success: true, message: `Vendor account has been ${statusMessage}.` };

    } catch (error: any) {
        console.error(`Failed to update status for vendor user ${vendorId}:`, error);
        return { success: false, message: `Failed to update status: ${error.message}` };
    }
  }
);
