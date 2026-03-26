
'use server';
/**
 * @fileOverview A flow to notify a staff member when a new customer is assigned to them.
 *
 * - sendCustomerAssignmentEmail - Creates a notification and sends an email to the staff member.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { createNotification } from './create-notification-flow';
import { sendWhatsAppMessage } from '@/lib/whatsapp-helpers';

const CustomerAssignmentInputSchema = z.object({
    staffId: z.string(),
    staffName: z.string(),
    staffEmail: z.string().email(),
    staffMobile: z.string().optional(),
    customerId: z.string(),
    customerName: z.string(),
});

export type CustomerAssignmentInput = z.infer<typeof CustomerAssignmentInputSchema>;

export async function sendCustomerAssignmentEmail(input: CustomerAssignmentInput): Promise<{ success: boolean; message: string; }> {
    return sendCustomerAssignmentEmailFlow(input);
}

const createAssignmentEmailTemplate = (staffName: string, customerName: string, customerId: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background-color: #17A2B8; padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Customer Assigned</h1>
        </div>
        <div class="content">
            <p>Hi ${staffName.split(' ')[0]},</p>
            <p>A new customer, <strong>${customerName}</strong>, has been assigned to you by the admin.</p>
            <p>Please review their profile and get started on their diet plan as soon as possible. You can view their details by clicking the button below.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/staff/my-customers/view/${customerId}" class="button">View Customer Profile</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;


const sendCustomerAssignmentEmailFlow = ai.defineFlow(
    {
        name: 'sendCustomerAssignmentEmailFlow',
        inputSchema: CustomerAssignmentInputSchema,
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    },
    async ({ staffId, staffName, staffEmail, staffMobile, customerId, customerName }) => {

        // 1. Create an in-app notification for the staff member
        await createNotification({
            userId: staffId,
            message: `You have been assigned a new customer: ${customerName}.`,
            link: `/staff/my-customers/view/${customerId}`
        });

        // 1.5 Send WhatsApp notification to staff
        if (staffMobile) {
            sendWhatsAppMessage({
                to: staffMobile,
                toName: staffName,
                toUserId: staffId,
                templateName: 'diet_plan_assigned_staff',
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: staffName },
                            { type: 'text', text: customerName },
                        ],
                    },
                ],
                metadata: { type: 'assignment', customerName },
            }).catch(console.error);
        }

        // 2. Send an email to the staff member
        if (!process.env.SMTP_HOST) {
            const msg = "SMTP settings not configured. Cannot send assignment email.";
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

        const emailHtml = createAssignmentEmailTemplate(staffName, customerName, customerId);

        try {
            await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
                to: staffEmail,
                subject: `New Customer Assignment: ${customerName}`,
                html: emailHtml,
            });

            const successMsg = `Successfully notified ${staffName} about new customer ${customerName}.`;
            console.log(successMsg);
            return { success: true, message: successMsg };

        } catch (error: any) {
            const errorMsg = `Failed to send assignment email to ${staffEmail}: ${error.message}`;
            console.error(errorMsg);
            return { success: false, message: errorMsg };
        }
    }
);
