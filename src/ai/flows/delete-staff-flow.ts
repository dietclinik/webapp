
'use server';
/**
 * @fileOverview A flow to completely delete a staff member.
 *
 * - deleteStaff - Deletes a staff user from Firebase Auth, their data from Firestore, and unassigns them from customers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';

const DeleteStaffInputSchema = z.object({
  staffId: z.string().describe('The UID of the staff user to delete.'),
});
export type DeleteStaffInput = z.infer<typeof DeleteStaffInputSchema>;

export async function deleteStaff(input: DeleteStaffInput): Promise<{ success: boolean; message: string }> {
  return deleteStaffFlow(input);
}

const deleteStaffFlow = ai.defineFlow(
  {
    name: 'deleteStaffFlow',
    inputSchema: DeleteStaffInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ staffId }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    try {
        // 1. Delete from Firebase Authentication
        await admin.auth().deleteUser(staffId);
        
        const batch = db.batch();

        // 2. Delete from Firestore 'staff' collection
        const staffDocRef = db.collection("staff").doc(staffId);
        batch.delete(staffDocRef);

        // 3. Find and unassign from all customers
        const customersQuery = db.collection("customers").where("assignedStaffId", "==", staffId);
        const customersSnapshot = await customersQuery.get();
        
        customersSnapshot.forEach(doc => {
            batch.update(doc.ref, { assignedStaffId: null });
        });

        await batch.commit();

        return { success: true, message: "Staff member deleted and unassigned from customers." };

    } catch (error: any) {
        console.error(`Failed to delete staff user ${staffId}:`, error);
        
        // If user is not found in Auth, but we still want to clean up Firestore
        if (error.code === 'auth/user-not-found') {
            const batch = db.batch();
            const staffDocRef = db.collection("staff").doc(staffId);
            batch.delete(staffDocRef);

            const customersQuery = db.collection("customers").where("assignedStaffId", "==", staffId);
            const customersSnapshot = await customersQuery.get();
            customersSnapshot.forEach(doc => {
                batch.update(doc.ref, { assignedStaffId: null });
            });
            await batch.commit();
            return { success: true, message: "User not found in Auth, but Firestore records cleaned up." };
        }
        
        return { success: false, message: `Failed to delete staff member: ${error.message}` };
    }
  }
);
