
'use server';
/**
 * @fileOverview A flow to send bulk marketing emails to a list of customers.
 *
 * - sendBulkEmail - Takes a list of recipients, subject, and content to send emails.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';

const BulkEmailInputSchema = z.object({
  recipients: z.array(z.object({ name: z.string(), email: z.string().email() })),
  subject: z.string(),
  body: z.string(),
  imageUrl: z.string().url().optional(),
  attachment: z.object({
      filename: z.string(),
      content: z.string(), // Base64 encoded content
  }).optional(),
});

export type BulkEmailInput = z.infer<typeof BulkEmailInputSchema>;

export async function sendBulkEmail(input: BulkEmailInput): Promise<{ success: boolean; message: string; sentCount: number }> {
  return sendBulkEmailFlow(input);
}

const createEmailTemplate = (name: string, body: string, imageUrl?: string) => {
    // Replace placeholder for customer's name
    const personalizedBody = body.replace(/{customer_name}/g, name);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
            .container { max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
            .header { padding: 0; text-align: center; }
            .content { padding: 30px; color: #333333; line-height: 1.6; }
            .footer { background-color: #f8f9fa; color: #6c757d; padding: 20px; text-align: center; font-size: 12px; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            ${imageUrl ? `<div class="header"><img src="${imageUrl}" alt="Header Image"></div>` : ''}
            <div class="content">
                ${personalizedBody}
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
                <p>If you wish to unsubscribe, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};


const sendBulkEmailFlow = ai.defineFlow(
  {
    name: 'sendBulkEmailFlow',
    inputSchema: BulkEmailInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string(), sentCount: z.number() }),
  },
  async ({ recipients, subject, body, imageUrl, attachment }) => {
    if (!process.env.SMTP_HOST) {
      const msg = "SMTP settings not configured. Cannot send bulk emails.";
      console.error(msg);
      return { success: false, message: msg, sentCount: 0 };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
       pool: true,
       maxConnections: 5
    });

    let sentCount = 0;
    
    // We send emails in parallel but limit concurrency to avoid overwhelming the SMTP server.
    const promises = recipients.map(recipient => async () => {
        const finalHtml = createEmailTemplate(recipient.name, body, imageUrl);
        
        let attachments: Attachment[] = [];
        if (attachment) {
            attachments.push({
                filename: attachment.filename,
                content: attachment.content.split('base64,')[1],
                encoding: 'base64',
            });
        }
        
        try {
            await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
                to: recipient.email,
                subject: subject,
                html: finalHtml,
                attachments: attachments,
            });
            sentCount++;
            console.log(`Bulk email sent to ${recipient.email}`);
        } catch (error: any) {
             console.error(`Failed to send email to ${recipient.email}: ${error.message}`);
        }
    });

    // Simple concurrency limiting
    const concurrency = 5;
    for (let i = 0; i < promises.length; i += concurrency) {
        const batch = promises.slice(i, i + concurrency);
        await Promise.all(batch.map(p => p()));
    }

    const message = `Bulk email campaign finished. Sent ${sentCount} of ${recipients.length} emails.`;
    console.log(message);
    return { success: true, message, sentCount };
  }
);
