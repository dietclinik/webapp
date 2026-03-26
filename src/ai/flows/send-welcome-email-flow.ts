

'use server';
/**
 * @fileOverview A flow to handle the post-payment process for new and renewing customers.
 *
 * - processNewCustomer - Handles user creation, data saving, and email notifications based on payment status.
 * - ProcessCustomerInput - The input type for the processNewCustomer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';
import { sendWhatsAppMessage } from './send-whatsapp-message-flow';
import { sendTransactionalEmail } from './send-transactional-email-flow';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { type ProcessCustomerInput } from '@/app/types';



export async function processNewCustomer(input: ProcessCustomerInput): Promise<{ userId?: string; message: string }> {
  return newCustomerFlow(input);
}

const generatePassword = (length = 8) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

// Helper to upload a data URI to Firebase Storage
const uploadImageFromDataUri = async (dataUri: string, userId: string, view: string): Promise<string> => {
    const match = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error(`Invalid data URI format for ${view} image.`);
    
    const [_, mimeType, base64Data] = match;
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `customer_body_images/${userId}/${view}_${Date.now()}_${uuidv4()}`;
    
    const storage = getStorage();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        throw new Error("Firebase Storage bucket name is not configured.");
    }
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(buffer, {
        metadata: { contentType: mimeType },
        public: true, // Make file publicly readable
    });
    return file.publicUrl();
}


const newCustomerFlow = ai.defineFlow(
  {
    name: 'newCustomerFlow',
    inputSchema: z.any(), // Using z.any() because the schema is in a separate file to avoid circular deps
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async (input) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    let { paymentSuccess, isRenewal, customerData, profileData, bmiValue, bmiMessage, vendorId, vendorName } = input as ProcessCustomerInput;
    const { name, email, planId, mobile } = customerData;
    const { frontImageDataUri, backImageDataUri, leftImageDataUri, rightImageDataUri, ...restOfProfileData } = profileData;
    const temporaryId = input.userId && input.userId.startsWith('unpaid_') ? input.userId : null;
    const password = generatePassword();

    // Fetch settings from Firestore
    const settingsDoc = await db.collection('settings').doc('global').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const messagingSettings = settingsData?.messagingSettings || {};
    
    let planData: any = {};
    try {
        const planDoc = await db.collection("subscriptionPlans").doc(planId).get();
        if (planDoc.exists) {
            planData = planDoc.data()!;
        }
    } catch(e) {
        console.error("Could not fetch plan details for email/history.");
    }
    
    const planName = planData.name || "N/A";
    const planPrice = planData.price || 0;

    if (process.env.ADMIN_EMAIL) {
         sendTransactionalEmail({ 
            name, 
            email, 
            template: 'adminNotification',
            planName,
            paymentStatus: customerData.paymentStatus
        });
    }

    const notificationMessage = isRenewal 
        ? `${name} has renewed their subscription for the ${planName} plan.`
        : `${name} has just registered for the ${planName} plan.`;
    
    await createNotification({
        userId: 'admin',
        message: notificationMessage,
        link: `/admin/customers`,
    });


    if (paymentSuccess) {
        let userRecord;
        let userId = input.userId;
        let existingCustomerData: any = null;

        try {
            if (userId && !userId.startsWith('unpaid_')) {
                userRecord = await admin.auth().getUser(userId);
            } else {
                 userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
            }
            
            if (userRecord) {
                 const existingCustomerDoc = await db.collection("customers").doc(userRecord.uid).get();
                 if (existingCustomerDoc.exists) {
                     existingCustomerData = existingCustomerDoc.data();
                 }
            }


            if (!userRecord) { 
                 userRecord = await admin.auth().createUser({
                    email: email,
                    emailVerified: false,
                    password: password,
                    displayName: name,
                    disabled: false,
                });
                userId = userRecord.uid;
                sendTransactionalEmail({ name, email, template: 'welcome', password, bmiValue, bmiMessage });
            } else {
                 userId = userRecord.uid;
                 
                 if (!existingCustomerData) {
                     sendTransactionalEmail({ name, email, template: 'welcome', password, bmiValue, bmiMessage });
                 } else if (isRenewal) {
                     const oldPlanId = existingCustomerData.planId;
                     if (oldPlanId && oldPlanId !== planId) {
                         sendTransactionalEmail({ name, email, template: 'upgradeSuccess', planName });
                     } else {
                         sendTransactionalEmail({ name, email, template: 'renewalSuccess', planName });
                     }
                 }
            }

        } catch (error: any) {
             console.error(`Error processing user in Firebase Auth: ${error.message}`);
             throw new Error(`Failed to process user in Firebase Auth: ${error.message}`);
        }
        
        if (!userId) {
            throw new Error("User ID could not be determined.");
        }
        
        // Handle image uploads
        let imageUrls: { [key: string]: string } = { };
        try {
            if (frontImageDataUri) imageUrls.frontImageUrl = await uploadImageFromDataUri(frontImageDataUri, userId, 'front');
            if (backImageDataUri) imageUrls.backImageUrl = await uploadImageFromDataUri(backImageDataUri, userId, 'back');
            if (leftImageDataUri) imageUrls.leftImageUrl = await uploadImageFromDataUri(leftImageDataUri, userId, 'left');
            if (rightImageDataUri) imageUrls.rightImageUrl = await uploadImageFromDataUri(rightImageDataUri, userId, 'right');
        } catch(uploadError: any) {
             console.error("Error uploading body images:", uploadError.message);
             // Non-critical, so we just log it and continue
        }

        if (isRenewal && existingCustomerData && existingCustomerData.vendorId) {
            vendorId = existingCustomerData.vendorId;
            vendorName = existingCustomerData.vendorName;
        }
        
        const customerDocRef = db.collection("customers").doc(userId);
        const profileDocRef = db.collection("userProfiles").doc(userId);
        const historyCollectionRef = db.collection('subscriptionHistory');
        const batch = db.batch();
        
        const customerDataForFirestore = {
            ...customerData,
            subscriptionStartDate: Timestamp.fromDate(new Date(customerData.subscriptionStartDate)),
            subscriptionEndDate: Timestamp.fromDate(new Date(customerData.subscriptionEndDate)),
            userId,
            ...(vendorId && { vendorId }),
            ...(vendorName && { vendorName }),
        };
        
        batch.set(customerDocRef, customerDataForFirestore, { merge: true });
        
        const profileDataToSave = {
            ...restOfProfileData,
            ...imageUrls,
            healthProblems: profileData.healthProblems || "",
            allergies: profileData.allergies || "",
        };
        batch.set(profileDocRef, profileDataToSave, { merge: true });

        let vendorEarning = 0;
        if (vendorId && planData.vendorShareType && planData.vendorShareValue) {
            if (planData.vendorShareType === 'percentage') {
                vendorEarning = (planData.price * planData.vendorShareValue) / 100;
            } else if (planData.vendorShareType === 'fixed') {
                vendorEarning = planData.vendorShareValue;
            }
        }

        const newHistoryRef = historyCollectionRef.doc();
        batch.set(newHistoryRef, {
            userId: userId,
            vendorId: vendorId || null,
            planId: planId,
            planName: planName,
            amount: planPrice,
            vendorEarning: vendorEarning,
            purchaseDate: Timestamp.now(),
            status: 'Paid'
        });

        if (temporaryId && temporaryId !== userId) {
            const tempCustomerRef = db.collection("customers").doc(temporaryId);
            const tempProfileRef = db.collection("userProfiles").doc(temporaryId);
            batch.delete(tempCustomerRef);
            batch.delete(tempProfileRef);
        }
        
        await batch.commit().catch(e => {
            console.error("Firestore batch commit failed:", e);
            throw new Error(`Failed to save customer data to the database: ${e.message}`);
        });

        const welcomeTemplateConfig = messagingSettings?.welcome;
        const renewalTemplateConfig = messagingSettings?.renewalSuccess;

        const getOrderedVars = (config: any, data: any): string[] => {
            if (!config?.variables) return [];
            return Object.keys(config.variables)
              .sort()
              .map(key => {
                const fieldName = config.variables[key];
                return data[fieldName] || '';
              })
              .filter(v => v);
        };
        
        const templateData = {
            customerName: name.split(' ')[0],
            planName: planName
        };

        if (isRenewal && renewalTemplateConfig?.templateName) {
            const vars = getOrderedVars(renewalTemplateConfig, templateData);
             await sendWhatsAppMessage({ templateName: renewalTemplateConfig.templateName, recipient: mobile, variables: vars });
        } else if (!isRenewal && welcomeTemplateConfig?.templateName) {
            const vars = getOrderedVars(welcomeTemplateConfig, templateData);
            await sendWhatsAppMessage({ templateName: welcomeTemplateConfig.templateName, recipient: mobile, variables: vars });
        }

        return { userId, message: isRenewal ? "Subscription renewed successfully." : "Customer created and welcome email sent." };

    } else {
        const temporaryId = `unpaid_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const customerDocRef = db.collection("customers").doc(temporaryId);
        const profileDocRef = db.collection("userProfiles").doc(temporaryId);

        const batch = db.batch();

        const customerDataForFirestore = {
            ...customerData,
            subscriptionStartDate: Timestamp.fromDate(new Date(customerData.subscriptionStartDate)),
            subscriptionEndDate: Timestamp.fromDate(new Date(customerData.subscriptionEndDate)),
            userId: temporaryId,
            ...(vendorId && { vendorId }),
            ...(vendorName && { vendorName }),
        };

        batch.set(customerDocRef, customerDataForFirestore);
        const profileDataToSave = {
            ...restOfProfileData,
            healthProblems: profileData.healthProblems || "",
            allergies: profileData.allergies || "",
        };
        batch.set(profileDocRef, profileDataToSave);
        await batch.commit().catch(e => {
            console.error("Firestore batch commit failed for unpaid user:", e);
            throw new Error(`Failed to save customer data to the database: ${e.message}`);
        });
        
        await createNotification({
            userId: 'admin',
            message: `Payment failed for ${name} trying to subscribe to the ${planName} plan.`,
            link: `/admin/customers/edit/${temporaryId}`,
        });
        
        const paymentFailedConfig = messagingSettings?.paymentFailed;
        if (paymentFailedConfig?.templateName) {
            const vars = [name.split(' ')[0]]; // Assume `name` is var1
            await sendWhatsAppMessage({ templateName: paymentFailedConfig.templateName, recipient: mobile, variables: vars });
        }

        sendTransactionalEmail({ name, email, template: 'paymentFailed' });
        return { message: "Customer data saved with payment failed status." };
    }
  }
);
