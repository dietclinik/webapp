
'use server';
/**
 * @fileOverview A flow to handle a new employee registration for a corporate event.
 *
 * - registerCorporateCustomer - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendTransactionalEmail } from './send-transactional-email-flow';
import { createNotification } from './create-notification-flow';
import { format } from 'date-fns';

const RegisterCustomerInputSchema = z.object({
  eventId: z.string(),
  name: z.string(),
  email: z.string().email(),
  mobile: z.string(),
  designation: z.string(),
  age: z.coerce.number(),
  gender: z.string(),
  height: z.coerce.number(),
  weight: z.coerce.number(),
  neck: z.coerce.number(),
  waist: z.coerce.number(),
  hips: z.coerce.number().optional(),
  activityLevel: z.string().optional(),
  healthProblems: z.string().optional(),
  allergies: z.string().optional(),
  foodPreference: z.enum(["veg", "non-veg"]).optional(),
  smoking: z.enum(["yes", "no"]).optional(),
  alcohol: z.enum(["yes", "no"]).optional(),
  protein: z.string().optional(),
  carbs: z.string().optional(),
  fat: z.string().optional(),
  fibre: z.string().optional(),
});

export type RegisterCustomerInput = z.infer<typeof RegisterCustomerInputSchema>;

export async function registerCorporateCustomer(input: RegisterCustomerInput): Promise<{ userId?: string; message: string }> {
  return registerCorporateCustomerFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const registerCorporateCustomerFlow = ai.defineFlow(
  {
    name: 'registerCorporateCustomerFlow',
    inputSchema: RegisterCustomerInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async ({ eventId, name, email, mobile, designation, ...profileData }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    let eventData;
    let corporateId;
    let eventCollectionPath = 'corporateEvents'; // Default for partner-created events

    const corporateEventDocRef = db.collection('corporateEvents').doc(eventId);
    const corporateEventSnap = await corporateEventDocRef.get();

    if (corporateEventSnap.exists) {
        eventData = corporateEventSnap.data();
        corporateId = eventData!.corporateId;
    } else {
        const adminEventDocRef = db.collection('events').doc(eventId);
        const adminEventSnap = await adminEventDocRef.get();
        if (adminEventSnap.exists) {
            eventData = adminEventSnap.data();
            corporateId = eventData!.corporateId;
            eventCollectionPath = 'events';
        } else {
             throw new Error("Event not found.");
        }
    }

    if (!corporateId) {
        throw new Error("Corporate partner for this event not found.");
    }

    const corporateDocRef = db.collection('corporates').doc(corporateId);
    const corporateSnap = await corporateDocRef.get();
    if (!corporateSnap.exists) {
        throw new Error("Corporate partner for this event not found.");
    }
    const corporateData = corporateSnap.data();
    const corporateName = corporateData!.name;
    const subscriptionEndDate = corporateData!.subscriptionEndDate;
    const planId = corporateData!.planId;

    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
        throw new Error("An account with this email already exists.");
    } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
            throw error; 
        }
    }

    const password = generatePassword();
    userRecord = await admin.auth().createUser({
        email,
        emailVerified: false,
        password,
        displayName: name,
        disabled: false,
    });
    
    const userId = userRecord.uid;
    const startDate = new Date();

    const customerData = {
        name,
        email,
        mobile,
        corporateId,
        corporateName,
        planId: planId || null,
        status: 'Active',
        paymentStatus: 'Paid',
        since: format(startDate, "yyyy-MM-dd"),
        subscriptionStartDate: Timestamp.fromDate(startDate),
        subscriptionEndDate: subscriptionEndDate || Timestamp.fromDate(startDate),
        isNew: true,
        dietPlanId: null,
        activityLevel: profileData.activityLevel,
    };
    
    const profileDataToSave = {
        ...profileData,
        name,
        email,
        designation,
    };

    const registrationRef = db.collection(`${eventCollectionPath}/${eventId}/registrations`).doc();
    const customerDocRef = db.collection('customers').doc(userId);
    const profileDocRef = db.collection('userProfiles').doc(userId);
    
    const batch = db.batch();
    batch.set(registrationRef, {
        userId,
        name,
        email,
        mobile,
        designation,
        registeredAt: Timestamp.now(),
    });
    batch.set(customerDocRef, customerData);
    batch.set(profileDocRef, profileDataToSave, { merge: true });
    await batch.commit();
    
    await sendTransactionalEmail({
        template: 'welcome',
        name,
        email,
        password,
    });
    
     await createNotification({
        userId: 'admin',
        message: `${name} has registered for the event "${eventData!.title}" from ${corporateName}.`,
        link: `/admin/corporates/view/${corporateId}`
    });
    
    await createNotification({
        userId: corporateId,
        message: `${name} has registered for your event: "${eventData!.title}".`,
        link: `/corporate/events/view/${eventId}`
    });
    

    return { userId, message: "Registration successful. Welcome email sent." };
  }
);
