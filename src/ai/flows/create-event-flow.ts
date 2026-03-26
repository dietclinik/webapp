
'use server';
/**
 * @fileOverview A flow to create a corporate event, save it, and notify the corporate partner.
 *
 * - createCorporateEvent - Creates an event, saves it to Firestore, and emails the corporate partner.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';
import { format } from 'date-fns';

const CreateEventInputSchema = z.object({
  title: z.string().describe('The title of the event.'),
  description: z.string().optional().describe('The description or details for the event.'),
  corporateId: z.string().describe('The Firestore UID of the corporate partner.'),
  corporateName: z.string().describe('The name of the corporate partner.'),
  corporateEmail: z.string().email().describe('The email of the corporate partner.'),
  venue: z.string().describe('The location of the event.'),
  eventTime: z.string().describe('The date and time of the event.'),
  registrationCloseDate: z.string().describe('The closing date for event registrations.'),
  participants: z.coerce.number().describe('The expected number of participants.'),
});

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

export async function createCorporateEvent(input: CreateEventInput): Promise<{ success: boolean; message: string; eventId?: string; }> {
  return createCorporateEventFlow(input);
}

const createEventEmailTemplate = (corporateName: string, eventTitle: string, eventDescription: string | undefined, venue: string, eventTime: string, participants: number) => `
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
        .details-box { background-color: #f8f9fa; border-left: 4px solid #fbbc05; padding: 20px; margin-top: 20px; }
        .details-box p { margin: 10px 0; }
        .button { display: inline-block; background-color: #34A853; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Event Scheduled!</h1>
        </div>
        <div class="content">
            <p>Hi ${corporateName},</p>
            <p>A new event has been scheduled for your organization by the Diet Clinik team. Please find the details below:</p>
            <div class="details-box">
                <p><strong>Event:</strong> ${eventTitle}</p>
                ${eventDescription ? `<p><strong>Description:</strong> ${eventDescription.replace(/\n/g, '<br>')}</p>` : ''}
                <p><strong>Venue:</strong> ${venue}</p>
                <p><strong>Date & Time:</strong> ${format(new Date(eventTime), 'PPP p')}</p>
                <p><strong>Expected Participants:</strong> ${participants}</p>
            </div>
            <p>You can view this event and manage your participating customers from your corporate dashboard.</p>
            <a href="https://app.dietclinik.com/corporate/dashboard" class="button">Go to Dashboard</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const createCorporateEventFlow = ai.defineFlow(
  {
    name: 'createCorporateEventFlow',
    inputSchema: CreateEventInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        eventId: z.string().optional(),
    }),
  },
  async (input) => {
    
    // 1. Save event to Firestore
    if (!db) {
        console.error("Firestore not available. Skipping event creation.");
        return { success: false, message: "Database not configured." };
    }
    
    const eventData = {
        ...input,
        eventTime: Timestamp.fromDate(new Date(input.eventTime)),
        registrationCloseDate: Timestamp.fromDate(new Date(input.registrationCloseDate)),
        createdAt: Timestamp.now(),
        status: 'Upcoming',
    };

    const docRef = await db.collection('events').add(eventData);

    // 2. Create in-app notification for the corporate user
    await createNotification({
        userId: input.corporateId,
        message: `A new event "${input.title}" has been scheduled for you.`,
        link: `/corporate/dashboard` // Can be changed to a specific event page later
    });

    // 3. Send an email to the corporate contact
    if (!process.env.SMTP_HOST) {
        const msg = "SMTP settings not configured. Cannot send event notification email.";
        console.warn(msg);
        return { success: true, message: "Event created, but email notification was not sent (SMTP not configured).", eventId: docRef.id };
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

    const emailHtml = createEventEmailTemplate(input.corporateName, input.title, input.description, input.venue, input.eventTime, input.participants);

    try {
        await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: input.corporateEmail,
            subject: `New Event Scheduled: ${input.title}`,
            html: emailHtml,
        });
        
        const successMsg = `Successfully created event and sent notification to ${input.corporateName}.`;
        console.log(successMsg);
        return { success: true, message: successMsg, eventId: docRef.id };

    } catch (error: any) {
        const errorMsg = `Event created, but failed to send email: ${error.message}`;
        console.error(errorMsg);
        return { success: true, message: errorMsg, eventId: docRef.id };
    }
  }
);
