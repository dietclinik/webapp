
'use server';
/**
 * @fileOverview A flow to handle the creation of a new partner for the FITTBOSS Challenge.
 *
 * - addFITTBOSSGym - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays } from 'date-fns';
import { sendTransactionalEmail } from './send-transactional-email-flow';
import { createNotification } from './create-notification-flow';

const AddFitbossGymInputSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    mobile: z.string(),
    address: z.string(),
    durationDays: z.number(),
    maxCustomers: z.number(),
});

export type AddFitbossGymInput = z.infer<typeof AddFitbossGymInputSchema>;

export async function addFITTBOSSGym(input: AddFitbossGymInput): Promise<{ userId?: string; message: string }> {
  return addFitbossGymFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};


const addFitbossGymFlow = ai.defineFlow(
  {
    name: 'addFitbossGymFlow',
    inputSchema: AddFitbossGymInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async ({ name, email, mobile, address, durationDays, maxCustomers }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }

    const password = generatePassword();
    let userRecord;

    try {
        userRecord = await admin.auth().getUserByEmail(email).catch(() => null);

        if (userRecord) {
             throw new Error(`An account with the email ${email} already exists.`);
        }

        userRecord = await admin.auth().createUser({
            email,
            emailVerified: false,
            password,
            displayName: name,
            disabled: false,
        });

    } catch (error: any) {
        console.error(`Error creating partner user in Firebase Auth: ${error.message}`);
        throw new Error(`Failed to create partner user: ${error.message}`);
    }

    const userId = userRecord.uid;
    const vendorDocRef = db.collection("vendors").doc(userId);
    
    const startDate = new Date();
    const endDate = addDays(startDate, durationDays);

    const dataToSave = {
        name,
        email,
        mobile,
        address,
        maxCustomers,
        challenge: 'FITTBOSS', // Identifier for this type of partner
        status: 'Active',
        paymentStatus: 'Paid', // Admin-added are considered paid
        createdAt: Timestamp.now(),
        subscriptionStartDate: Timestamp.fromDate(startDate),
        subscriptionEndDate: Timestamp.fromDate(endDate),
    };
    
    await vendorDocRef.set(dataToSave, { merge: true });

    await sendTransactionalEmail({ 
        template: 'partnerWelcome',
        name, 
        email, 
        password 
    });
    
    await createNotification({
        userId: 'admin',
        message: `${name} has been added as a FITTBOSS Challenge partner.`,
        link: `/admin/FITTBOSS-challenge`
    });

    return { userId, message: "FITTBOSS Challenge gym created and welcome email sent." };
  }
);
