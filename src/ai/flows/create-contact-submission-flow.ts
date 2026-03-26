
'use server';
/**
 * @fileOverview A flow to save contact form submissions to Firestore and notify admin.
 *
 * - createContactSubmission - Saves the submission and sends an email to the admin.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendTransactionalEmail } from './send-transactional-email-flow';

const ContactSubmissionInputSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string(),
  subject: z.string().min(5),
  message: z.string().min(10),
});

export type ContactSubmissionInput = z.infer<typeof ContactSubmissionInputSchema>;

export async function createContactSubmission(input: ContactSubmissionInput): Promise<{ success: boolean; id?: string }> {
  return createContactSubmissionFlow(input);
}

const createContactSubmissionFlow = ai.defineFlow(
  {
    name: 'createContactSubmissionFlow',
    inputSchema: ContactSubmissionInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  },
  async (input) => {
    if (!db) {
      console.error("Firestore not available. Skipping contact submission.");
      return { success: false };
    }

    try {
      const submissionData = {
        ...input,
        createdAt: Timestamp.now(),
        isRead: false,
      };
      
      const docRef = await db.collection('contactSubmissions').add(submissionData);
      
      // Notify admin via email
      if (process.env.ADMIN_EMAIL) {
        sendTransactionalEmail({
            template: 'adminContactSubmission',
            name: input.name,
            email: input.email,
            mobile: input.mobile,
            subject: input.subject,
            message: input.message,
        }).catch(console.error);
      }

      console.log(`Contact submission saved with ID: ${docRef.id}`);
      return { success: true, id: docRef.id };

    } catch (error) {
      console.error('Failed to save contact submission:', error);
      return { success: false };
    }
  }
);
