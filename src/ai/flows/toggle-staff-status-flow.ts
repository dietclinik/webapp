
'use server';
/**
 * @fileOverview A flow to enable or disable a staff member's account.
 *
 * - toggleStaffStatus - Updates the disabled status of a user in Firebase Auth.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin } from '@/lib/firebase-admin';

const ToggleStaffStatusInputSchema = z.object({
  staffId: z.string().describe('The UID of the staff user.'),
  disabled: z.boolean().describe('The new disabled status for the user account.'),
});
export type ToggleStaffStatusInput = z.infer<typeof ToggleStaffStatusInputSchema>;

export async function toggleStaffStatus(input: ToggleStaffStatusInput): Promise<{ success: boolean; message: string }> {
  return toggleStaffStatusFlow(input);
}

const toggleStaffStatusFlow = ai.defineFlow(
  {
    name: 'toggleStaffStatusFlow',
    inputSchema: ToggleStaffStatusInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ staffId, disabled }) => {
    if (!admin.apps.length) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    try {
        await admin.auth().updateUser(staffId, {
            disabled: disabled,
        });

        const status = disabled ? "disabled" : "enabled";
        return { success: true, message: `Staff account has been ${status}.` };

    } catch (error: any) {
        console.error(`Failed to update status for staff user ${staffId}:`, error);
        return { success: false, message: `Failed to update status: ${error.message}` };
    }
  }
);
