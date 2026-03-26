

'use server';
/**
 * @fileOverview A flow to handle the creation of a new corporate partner.
 *
 * - sendCorporateWelcomeEmail - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { createNotification } from './create-notification-flow';
import { addDays, addMonths } from 'date-fns';
import { sendTransactionalEmail } from './send-transactional-email-flow';

const ProcessCorporateInputSchema = z.object({
    paymentSuccess: z.boolean(),
    corporateId: z.string().optional(), // For manual activation
    corporateData: z.object({
        name: z.string(),
        email: z.string().email(),
        mobile: z.string(),
        address: z.string(),
        planId: z.string(),
    }),
});

export type ProcessCorporateInput = z.infer<typeof ProcessCorporateInputSchema>;

export async function sendCorporateWelcomeEmail(input: ProcessCorporateInput): Promise<{ userId?: string; message: string }> {
  return newCorporateFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const sendEmailFlow = ai.defineFlow({
    name: 'sendCorporateWelcomeEmailFlow',
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

    const subject = 'Welcome to the Diet Clinik Corporate Program!';
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
            .header { background-color: #3B82F6; padding: 40px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px; color: #333333; line-height: 1.6; }
            .credentials-box { background-color: #f8f9fa; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; }
            .credentials-box p { margin: 5px 0; }
            .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome, ${name}!</h1>
            </div>
            <div class="content">
                <p>We are excited to have you as a corporate partner! Your account has been created.</p>
                <p>You can use the following credentials to log in to the corporate portal:</p>
                <div class="credentials-box">
                    <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff; text-decoration: none;">${email}</a></p>
                    <p><strong>Temporary Password:</strong></p>
                    <p style="word-wrap: break-word; font-family: monospace;">${password}</p>
                </div>
                <p>Please change this password after your first login.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/corporate/login" class="button">Go to Corporate Portal</a>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Corporate welcome email sent to ${email}`);
    } catch (error) {
        console.error("Error sending corporate email:", error);
    }
});

const newCorporateFlow = ai.defineFlow(
  {
    name: 'newCorporateFlow',
    inputSchema: ProcessCorporateInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async ({ paymentSuccess, corporateData, corporateId: temporaryId }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    const { name, email, mobile, planId, ...otherData } = corporateData;

    await createNotification({
        userId: 'admin',
        message: `A new corporate, ${name}, has registered. Payment status: ${paymentSuccess ? 'Paid' : 'Failed'}.`,
        link: `/admin/corporates`
    });

    const planDoc = await db.collection("subscriptionPlans").doc(planId).get();
    const planName = planDoc.exists ? planDoc.data()!.name : "N/A";

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
        const password = generatePassword();

        try {
            userRecord = await admin.auth().getUserByEmail(email).catch(() => null);

            if (!planDoc.exists) {
                throw new Error("Selected plan not found.");
            }
            const plan = planDoc.data()!;
            const startDate = new Date();
            let endDate = addMonths(startDate, plan.durationMonths || 0);
            endDate = addDays(endDate, plan.durationDays || 0);

            if(userRecord) {
                userId = userRecord.uid;
                console.log(`Corporate user ${email} already exists. Updating their record.`);
            } else {
                userRecord = await admin.auth().createUser({
                    email: email,
                    emailVerified: false,
                    password: password,
                    displayName: name,
                    disabled: false,
                });
                userId = userRecord.uid;
                await sendEmailFlow({ name, email, password });
            }

            const corporateDocRef = db.collection("corporates").doc(userId);
            const dataToSave = {
                name, email, mobile, planId, ...otherData,
                status: 'Active',
                paymentStatus: 'Paid',
                createdAt: userRecord.metadata.creationTime ? Timestamp.fromDate(new Date(userRecord.metadata.creationTime)) : Timestamp.now(),
                subscriptionStartDate: Timestamp.fromDate(startDate),
                subscriptionEndDate: Timestamp.fromDate(endDate),
            };
            await corporateDocRef.set(dataToSave, { merge: true });

            if (temporaryId && temporaryId !== userId) {
                const tempCorporateRef = db.collection("corporates").doc(temporaryId);
                await tempCorporateRef.delete();
            }

            return { userId, message: "Corporate partner created and welcome email sent." };

        } catch (error: any) {
            console.error(`Error processing new corporate: ${error.message}`);
            throw new Error(`Failed to create corporate partner: ${error.message}`);
        }
    } else { // Payment failed
        const tempId = `unpaid_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const corporateDocRef = db.collection("corporates").doc(tempId);
        
        const dataToSave = {
            name, email, mobile, planId, ...otherData,
            status: 'Inactive',
            paymentStatus: 'Failed',
            createdAt: Timestamp.now(),
        };
        await corporateDocRef.set(dataToSave);
        return { userId: tempId, message: "Corporate partner data saved with payment failed status." };
    }
  }
);

