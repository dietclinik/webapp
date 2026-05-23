
'use server';
/**
 * @fileOverview A flow to handle the creation of a new customer by a vendor.
 *
 * - sendVendorCustomerWelcomeEmail - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { createNotification } from './create-notification-flow';
import { format, addMonths, addDays } from 'date-fns';

const VendorCustomerWelcomeInputSchema = z.object({
    vendorId: z.string(),
    vendorName: z.string(),
    customerData: z.object({
        name: z.string(),
        email: z.string().email(),
        mobile: z.string(),
        planId: z.string(),
        activityLevel: z.string().optional(),
    }),
    profileData: z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.string(),
        gender: z.string(),
        height: z.string(),
        weight: z.string(),
        protein: z.string().optional(),
        carbs: z.string().optional(),
        fat: z.string().optional(),
        fibre: z.string().optional(),
    }),
});

export type VendorCustomerWelcomeInput = z.infer<typeof VendorCustomerWelcomeInputSchema>;

export async function sendVendorCustomerWelcomeEmail(input: VendorCustomerWelcomeInput): Promise<{ userId?: string; message: string }> {
  return newVendorCustomerFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const createWelcomeEmailTemplate = (name: string, email: string, password: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background-color: #4CAF50; padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .credentials-box { background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; }
        .credentials-box p { margin: 5px 0; }
        .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome, ${name.split(' ')[0]}!</h1>
        </div>
        <div class="content">
            <p>We are thrilled to have you join the Diet Clinik family! Your personalized journey to a healthier you starts now.</p>
            <p>Your account has been created. You can use the following credentials to log in to your dashboard:</p>
            <div class="credentials-box">
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff; text-decoration: none;">${email}</a></p>
                <p><strong>Temporary Password:</strong></p>
                <p style="word-wrap: break-word; font-family: monospace;">${password}</p>
            </div>
            <p>Please change this password after your first login.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="button">Go to Your Dashboard</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Vorynto Pvt. Ltd.</a></p>
        </div>
    </div>
</body>
</html>
`;


const sendEmailFlow = ai.defineFlow({
    name: 'sendVendorCustomerEmailFlow',
    inputSchema: z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string(),
    }),
    outputSchema: z.void(),
}, async (input) => {
    const { name, email, password } = input;

    if (!process.env.SMTP_HOST) {
        console.warn("SMTP settings not configured. Skipping welcome email.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const subject = 'Welcome to Your Health Journey!';
    const html = createWelcomeEmailTemplate(name, email, password);

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Vendor customer welcome email sent to ${email}`);
    } catch (error) {
        console.error("Error sending vendor customer email:", error);
    }
});

const newVendorCustomerFlow = ai.defineFlow(
  {
    name: 'newVendorCustomerFlow',
    inputSchema: VendorCustomerWelcomeInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async ({ vendorId, vendorName, customerData, profileData }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    const { name, email, planId } = customerData;
    const password = generatePassword();
    
    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
        if(userRecord) {
            throw new Error(`An account with the email ${email} already exists.`);
        }

        userRecord = await admin.auth().createUser({
            email: email,
            emailVerified: false,
            password: password,
            displayName: name,
            disabled: false,
        });

    } catch (error: any) {
        console.error(`Error creating customer user in Firebase Auth: ${error.message}`);
        throw new Error(`Failed to create customer user in Firebase Auth: ${error.message}`);
    }

    const userId = userRecord.uid;

    const planDoc = await db.collection("subscriptionPlans").doc(planId).get();
    if (!planDoc.exists) {
        throw new Error("Selected plan not found.");
    }
    const plan = planDoc.data()!;
    const startDate = new Date();
    let endDate = addMonths(startDate, plan.durationMonths || 0);
    endDate = addDays(endDate, plan.durationDays || 0);

    const customerDocRef = db.collection("customers").doc(userId);
    const profileDocRef = db.collection("userProfiles").doc(userId);

    const dataToSave = {
        ...customerData,
        vendorId,
        vendorName,
        status: 'Active',
        paymentStatus: 'Paid', // Vendor-added customers are considered paid
        since: format(startDate, "yyyy-MM-dd"),
        isNew: true,
        dietPlanId: null,
        subscriptionStartDate: Timestamp.fromDate(startDate),
        subscriptionEndDate: Timestamp.fromDate(endDate),
    };
    
    const profileDataToSave = {
        ...profileData,
        name: dataToSave.name,
        email: dataToSave.email,
    };
    
    await customerDocRef.set(dataToSave);
    await profileDocRef.set(profileDataToSave);

    await sendEmailFlow({ name, email, password });
    
    await createNotification({
        userId: 'admin',
        message: `${name} has been added as a customer by vendor ${vendorName}.`,
        link: `/admin/customers/view/${userId}`
    });

    return { userId, message: "Customer created and welcome email sent." };
  }
);
