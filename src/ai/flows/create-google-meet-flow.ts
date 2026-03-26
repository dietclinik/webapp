
'use server';
/**
 * @fileOverview A flow to create a Google Meet link, save it, and send it via email.
 *
 * - createGoogleMeet - Creates a meeting link, saves it to Firestore, and emails it to recipients.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// --- IMPORTANT ---
// This is a placeholder flow. For real Google Meet creation, you would need to:
// 1. Enable the Google Calendar API in your Google Cloud project.
// 2. Set up OAuth 2.0 credentials.
// 3. Use a library like `googleapis` to interact with the Calendar API to create an event with a conference link.
// 4. Handle token storage and refresh securely.
// This example simulates the process and sends an email with a dummy link.
// --- IMPORTANT ---

const CreateGoogleMeetInputSchema = z.object({
  title: z.string().describe('The title of the meeting.'),
  description: z.string().optional().describe('The agenda or description for the meeting.'),
  recipientEmails: z.array(z.string().email()).describe('A list of recipient email addresses.'),
});

export type CreateGoogleMeetInput = z.infer<typeof CreateGoogleMeetInputSchema>;

export async function createGoogleMeet(input: CreateGoogleMeetInput): Promise<{ success: boolean; message: string; meetLink?: string; }> {
  return createGoogleMeetFlow(input);
}

const createInvitationEmailTemplate = (title: string, description: string | undefined, meetLink: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background-color: #4285F4; padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .button { display: inline-block; background-color: #34A853; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
        .agenda { background-color: #f8f9fa; border-left: 4px solid #fbbc05; padding: 15px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Meeting Invitation</h1>
        </div>
        <div class="content">
            <p>You have been invited to a meeting.</p>
            <h2>${title}</h2>
            ${description ? `<div class="agenda"><strong>Agenda:</strong><p>${description.replace(/\n/g, '<br>')}</p></div>` : ''}
            <p>You can join the meeting from your dashboard or using the link below:</p>
            <a href="${meetLink}" class="button">Join Google Meet</a>
            <p style="margin-top: 20px;">Or copy and paste this link into your browser:<br><a href="${meetLink}" style="color: #4285F4;">${meetLink}</a></p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;


const createGoogleMeetFlow = ai.defineFlow(
  {
    name: 'createGoogleMeetFlow',
    inputSchema: CreateGoogleMeetInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        meetLink: z.string().optional(),
    }),
  },
  async ({ title, description, recipientEmails }) => {
    
    // Placeholder for Google Meet link creation
    const meetLink = `https://meet.google.com/lookup/${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[Placeholder] Generated Google Meet link: ${meetLink}`);

    if (db) {
        try {
            await db.collection('meetings').add({
                title,
                description: description || '',
                meetLink,
                participantEmails: recipientEmails,
                createdAt: Timestamp.now(),
            });
        } catch (dbError) {
             console.error("Failed to save meeting to Firestore:", dbError);
             // We can decide if this is a critical error. For now, we'll just log it.
        }
    }


    if (!process.env.SMTP_HOST) {
        const msg = "SMTP settings not configured. Cannot send meeting invitations.";
        console.warn(msg);
        return { success: false, message: msg };
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

    const emailHtml = createInvitationEmailTemplate(title, description, meetLink);

    try {
        const mailPromises = recipientEmails.map(email => {
            return transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
                to: email,
                subject: `Invitation: ${title}`,
                html: emailHtml,
            });
        });

        await Promise.all(mailPromises);
        
        console.log(`Invitations sent to: ${recipientEmails.join(', ')}`);
        return {
            success: true,
            message: `Successfully created meeting and sent ${recipientEmails.length} invitations.`,
            meetLink,
        };

    } catch (error: any) {
        console.error("Failed to send meeting invitations:", error);
        return {
            success: false,
            message: `Failed to send emails: ${error.message}`,
        };
    }
  }
);
