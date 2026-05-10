
'use server';
/**
 * @fileOverview A flow to handle the creation of a new partner.
 *
 * - processPartner - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, addMonths } from 'date-fns';
import { sendTransactionalEmail } from './send-transactional-email-flow';
import { createNotification } from './create-notification-flow';
import { sendWelcomePartner } from '@/lib/whatsapp-helpers';

const ProcessPartnerInputSchema = z.object({
    paymentSuccess: z.boolean(),
    vendorId: z.string().optional(), // For manual activation
    vendorData: z.object({
        name: z.string(),
        email: z.string().email(),
        mobile: z.string(),
        address: z.string(),
        planId: z.string(),
        durationMonths: z.number().optional(),
        durationDays: z.number().optional(),
        planVariantLabel: z.string().optional(),
        planPrice: z.number().optional(),
    }),
});

export type ProcessPartnerInput = z.infer<typeof ProcessPartnerInputSchema>;

export async function processPartner(input: ProcessPartnerInput): Promise<{ userId?: string; message: string }> {
    return newPartnerFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};


const newPartnerFlow = ai.defineFlow(
    {
        name: 'newPartnerFlow',
        inputSchema: ProcessPartnerInputSchema,
        outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
    },
    async ({ paymentSuccess, vendorData, vendorId: temporaryId }) => {
        if (!admin.apps.length || !db) {
            throw new Error("Firebase Admin SDK not initialized.");
        }

        const { name, email, mobile, planId, durationMonths, durationDays, planVariantLabel, planPrice, ...otherData } = vendorData;

        await createNotification({
            userId: 'admin',
            message: `A new partner, ${name}, has registered. Payment status: ${paymentSuccess ? 'Paid' : 'Failed'}.`,
            link: `/admin/partners`
        });

        const planDoc = await db.collection("subscriptionPlans").doc(planId).get();
        const planName = planDoc.exists ? planDoc.data()!.name : "N/A";
        const planTier = planDoc.exists ? planDoc.data()!.tier : "Freemium";

        sendTransactionalEmail({
            template: 'adminPartnerRegistration',
            name,
            email,
            planName,
            paymentStatus: paymentSuccess ? 'Paid' : 'Failed',
        }).catch(console.error);


        if (paymentSuccess) {
            let userRecord;
            let userId;

            try {
                userRecord = await admin.auth().getUserByEmail(email).catch(() => null);

                if (!planDoc.exists) {
                    // If it's a manual creation without a selected plan, allow it
                    if (planId !== 'manual_admin_created') {
                        throw new Error("Selected plan not found.");
                    }
                }
                const plan = planDoc.data() || {};
                const startDate = new Date();
                // Resolve duration: prefer explicitly passed values, then plan top-level, then first priceVariant
                const firstVariant = plan.priceVariants?.[0];
                const resolvedMonths = durationMonths ?? plan.durationMonths ?? firstVariant?.durationMonths ?? 0;
                const resolvedDays = durationDays ?? plan.durationDays ?? firstVariant?.durationDays ?? 0;
                let endDate = addMonths(startDate, resolvedMonths);
                endDate = addDays(endDate, resolvedDays);

                if (userRecord) {
                    // Existing partner is renewing/upgrading
                    userId = userRecord.uid;
                    console.log(`Partner user ${email} already exists. Updating their record.`);
                } else {
                    // This is a new partner
                    const collectionsToCheck = ['vendors', 'customers', 'staff'];
                    for (const collectionName of collectionsToCheck) {
                        const mobileQuery = db.collection(collectionName).where('mobile', '==', mobile);
                        const mobileSnapshot = await mobileQuery.get();
                        if (!mobileSnapshot.empty) {
                            throw new Error(`The mobile number ${mobile} is already in use by a ${collectionName.slice(0, -1)}.`);
                        }
                    }

                    const password = generatePassword();
                    userRecord = await admin.auth().createUser({
                        email: email,
                        emailVerified: false,
                        password: password,
                        displayName: name,
                        disabled: false,
                    });
                    userId = userRecord.uid;
                    await sendTransactionalEmail({
                        template: 'partnerWelcome',
                        name,
                        email,
                        password
                    });

                    // Send WhatsApp Welcome
                    if (mobile) {
                        sendWelcomePartner({
                            phone: mobile,
                            name,
                            userId
                        }).catch(console.error);
                    }
                }

                const vendorDocRef = db.collection("vendors").doc(userId);
                const dataToSave: Record<string, any> = {
                    name, email, mobile, planId, ...otherData,
                    planName,
                    status: 'Active',
                    paymentStatus: 'Paid',
                    tier: planTier,
                    createdAt: userRecord.metadata.creationTime ? Timestamp.fromDate(new Date(userRecord.metadata.creationTime)) : Timestamp.now(),
                    subscriptionStartDate: Timestamp.fromDate(startDate),
                    subscriptionEndDate: Timestamp.fromDate(endDate),
                };
                if (planVariantLabel) dataToSave.planVariantLabel = planVariantLabel;
                if (planPrice !== undefined) dataToSave.planPrice = planPrice;
                await vendorDocRef.set(dataToSave, { merge: true });

                if (temporaryId && temporaryId !== userId) {
                    const tempVendorRef = db.collection("vendors").doc(temporaryId);
                    await tempVendorRef.delete();
                }

                return { userId, message: "Partner created and welcome email sent." };

            } catch (error: any) {
                console.error(`Error processing new partner: ${error.message}`);
                throw new Error(`Failed to create partner: ${error.message}`);
            }
        } else { // Payment failed
            const tempId = `unpaid_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
            const vendorDocRef = db.collection("vendors").doc(tempId);

            const dataToSave = {
                name, email, mobile, planId, ...otherData,
                status: 'Inactive',
                paymentStatus: 'Failed',
                tier: planTier,
                createdAt: Timestamp.now(),
            };
            await vendorDocRef.set(dataToSave);
            return { userId: tempId, message: "Partner data saved with payment failed status." };
        }
    }
);
