
'use server';
/**
 * @fileOverview A flow to handle the creation of a new vendor.
 *
 * - processVendor - Handles user creation, data saving, and email notifications.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { createNotification } from './create-notification-flow';

const ProcessVendorInputSchema = z.object({
    paymentSuccess: z.boolean(),
    vendorId: z.string().optional(), // For manual activation
    vendorData: z.object({
        name: z.string(),
        email: z.string().email(),
        mobile: z.string(),
        address: z.string(),
    }),
});

export type ProcessVendorInput = z.infer<typeof ProcessVendorInputSchema>;

export async function processVendor(input: ProcessVendorInput): Promise<{ userId?: string; message: string }> {
  return newVendorFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const createVendorWelcomeEmailTemplate = (name: string, email: string, password: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background-color: #007bff; padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .credentials-box { background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0; }
        .credentials-box p { margin: 5px 0; }
        .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome Aboard, ${name}!</h1>
        </div>
        <div class="content">
            <p>We are excited to vendor with you! Your Vendor account has been created.</p>
            <p>You can use the following credentials to log in to the vendor portal:</p>
            <div class="credentials-box">
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff; text-decoration: none;">${email}</a></p>
                <p><strong>Temporary Password:</strong></p>
                <p style="word-wrap: break-word; font-family: monospace;">${password}</p>
            </div>
            <p>Please change this password after your first login.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/vendor/login" class="button">Go to Vendor Portal</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;

const sendEmailFlow = ai.defineFlow({
    name: 'sendVendorEmailFlow',
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

    const subject = 'Welcome to the Diet Clinik Vendor Network!';
    const html = createVendorWelcomeEmailTemplate(name, email, password);

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Vendor welcome email sent to ${email}`);
    } catch (error) {
        console.error("Error sending vendor email:", error);
    }
});

const newVendorFlow = ai.defineFlow(
  {
    name: 'newVendorFlow',
    inputSchema: ProcessVendorInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async ({ paymentSuccess, vendorData, vendorId: temporaryId }) => {
    if (!admin.apps.length || !db) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    const { name, email, ...otherData } = vendorData;

    await createNotification({
        userId: 'admin',
        message: `A new vendor, ${name}, has registered. Payment status: ${paymentSuccess ? 'Paid' : 'Failed'}.`,
        link: `/admin/vendors`
    });

    if (paymentSuccess) {
        const password = generatePassword();
        let userRecord;
        let userId;

        try {
            userRecord = await admin.auth().getUserByEmail(email).catch(() => null);

            if(userRecord) {
                userId = userRecord.uid;
                console.log(`Vendor user ${email} already exists. Updating their record.`);
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
        } catch (error: any) {
            console.error(`Error creating vendor user in Firebase Auth: ${error.message}`);
            throw new Error(`Failed to create vendor user in Firebase Auth: ${error.message}`);
        }

        const vendorDocRef = db.collection("vendors").doc(userId);
        const dataToSave = {
            name,
            email,
            ...otherData,
            status: 'Active',
            paymentStatus: 'Paid',
            createdAt: Timestamp.now(),
        };
        await vendorDocRef.set(dataToSave, { merge: true });

        // If this was an activation of a previously failed payment, delete the temporary doc
        if (temporaryId && temporaryId !== userId) {
            const tempVendorRef = db.collection("vendors").doc(temporaryId);
            await tempVendorRef.delete();
        }

        return { userId, message: "Vendor created and welcome email sent." };
    } else { // Payment failed
        const tempId = `unpaid_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const vendorDocRef = db.collection("vendors").doc(tempId);
        
        const dataToSave = {
            name,
            email,
            ...otherData,
            status: 'Inactive',
            paymentStatus: 'Failed',
            createdAt: Timestamp.now(),
        };
        await vendorDocRef.set(dataToSave);
        return { userId: tempId, message: "Vendor data saved with payment failed status." };
    }
  }
);
