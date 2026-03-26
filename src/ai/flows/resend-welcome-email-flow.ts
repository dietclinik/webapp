
'use server';
/**
 * @fileOverview A flow to resend a welcome email with a new temporary password.
 *
 * - resendWelcomeEmail - Resets a user's password and sends them an email with the new credentials.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

const ResendWelcomeInputSchema = z.object({
  userId: z.string().describe('The UID of the user.'),
  name: z.string().describe('The name of the user.'),
  email: z.string().email().describe('The email of the user.'),
  userType: z.enum(['customer', 'staff', 'partner', 'corporate']).describe('The type of user.'),
});

export type ResendWelcomeInput = z.infer<typeof ResendWelcomeInputSchema>;

export async function resendWelcomeEmail(input: ResendWelcomeInput): Promise<{ success: boolean; message: string }> {
  return resendWelcomeEmailFlow(input);
}

const generatePassword = (length = 10) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const createEmailTemplate = (name: string, email: string, password: string, userType: string) => {
    const portalMap = {
        customer: { name: 'Customer Dashboard', url: `${process.env.NEXT_PUBLIC_APP_URL}/login` },
        staff: { name: 'Staff Portal', url: `${process.env.NEXT_PUBLIC_APP_URL}/staff` },
        partner: { name: 'Partner Portal', url: `${process.env.NEXT_PUBLIC_APP_URL}/partner/login` },
        corporate: { name: 'Corporate Portal', url: `${process.env.NEXT_PUBLIC_APP_URL}/corporate/login` },
    };
    const portal = portalMap[userType as keyof typeof portalMap];

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: sans-serif; background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; padding: 30px; }
            .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 20px; }
            .content { padding: 20px 0; }
            .credentials { background-color: #f9f9f9; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background-color: #007bff; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Account Details Reset</h2>
            </div>
            <div class="content">
                <p>Hello ${name},</p>
                <p>As requested, your login password has been reset. You can use the new temporary credentials below to access the ${portal.name}.</p>
                <div class="credentials">
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>New Temporary Password:</strong> ${password}</p>
                </div>
                <p>Please change this password after you log in.</p>
                <a href="${portal.url}" class="button">Go to Login</a>
            </div>
        </div>
    </body>
    </html>
    `;
};


const resendWelcomeEmailFlow = ai.defineFlow(
  {
    name: 'resendWelcomeEmailFlow',
    inputSchema: ResendWelcomeInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ userId, name, email, userType }) => {
    if (!admin.apps.length) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
     if (!process.env.SMTP_HOST) {
        throw new Error("SMTP settings not configured.");
    }

    const password = generatePassword();
    
    try {
        await admin.auth().updateUser(userId, { password: password });
    } catch (error: any) {
        console.error(`Failed to update password for ${userId}:`, error);
        return { success: false, message: `Failed to reset password in Firebase Auth: ${error.message}` };
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

    const emailHtml = createEmailTemplate(name, email, password, userType);

    try {
        await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Your Account Credentials Have Been Reset',
            html: emailHtml,
        });

        return { success: true, message: `Welcome email successfully resent to ${email}.` };
    } catch (error: any) {
        console.error(`Failed to send email to ${email}:`, error);
        return { success: false, message: `Failed to send email: ${error.message}` };
    }
  }
);
