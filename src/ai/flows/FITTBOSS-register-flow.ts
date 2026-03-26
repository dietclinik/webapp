
'use server';
/**
 * @fileOverview A flow to handle registrations for the FITTBOSS challenge.
 *
 * - registerFITTBOSSChallenge - Saves registration data, handles logo upload, and updates payment status.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

// Schema for the initial data capture (pre-payment)
const PrePaymentSchema = z.object({
  gymName: z.string(),
  gymOwnerName: z.string(),
  gymContactNumber: z.string(),
  participantName: z.string(),
  participantAge: z.coerce.number(),
  participantWeight: z.coerce.number(),
  participantTShirtSize: z.string(),
  paymentSuccess: z.literal(false),
});

// Schema for the post-payment status update
const PostPaymentSchema = z.object({
  registrationId: z.string(),
  paymentSuccess: z.boolean(),
});

// The input schema for the flow can be one of the two types
const InputSchema = z.union([PrePaymentSchema, PostPaymentSchema]);

export async function registerFITTBOSSChallenge(input: z.infer<typeof InputSchema>): Promise<{ registrationId?: string; message: string }> {
  return registerFitbossChallengeFlow(input);
}

const registerFitbossChallengeFlow = ai.defineFlow(
  {
    name: 'registerFitbossChallengeFlow',
    inputSchema: InputSchema,
    outputSchema: z.object({ registrationId: z.string().optional(), message: z.string() }),
  },
  async (input) => {
    if (!db) {
      throw new Error("Firestore not available.");
    }

    if ('registrationId' in input) {
      // This is a post-payment update
      const { registrationId, paymentSuccess } = input;
      const docRef = db.collection('fitbossRegistrations').doc(registrationId);

      try {
        await docRef.update({
            paymentStatus: paymentSuccess ? 'Paid' : 'Failed',
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { message: "Payment status updated." };
      } catch (error: any) {
        console.error(`Failed to update payment status for ${registrationId}:`, error);
        throw new Error(`Could not update payment status: ${error.message}`);
      }

    } else {
      // This is the initial pre-payment data capture
      const { ...registrationData } = input;

      try {
        const dataToSave = {
            ...registrationData,
            paymentStatus: 'Pending',
            createdAt: FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('fitbossRegistrations').add(dataToSave);
        console.log(`FITTBOSS pre-registration saved with ID: ${docRef.id}`);
        return { registrationId: docRef.id, message: "Pre-registration successful." };

      } catch (error: any) {
        console.error('Failed to save pre-registration data:', error);
        throw new Error(`Could not save registration data: ${error.message}`);
      }
    }
  }
);
