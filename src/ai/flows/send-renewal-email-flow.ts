

'use server';
/**
 * @fileOverview A flow to send subscription renewal reminders.
 *
 * - sendRenewalReminders - Finds customers whose subscriptions are expiring and sends them an email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { createNotification } from './create-notification-flow';
import { sendWhatsAppMessage } from './send-whatsapp-message-flow';
import { sendTransactionalEmail } from './send-transactional-email-flow';

const createRenewalEmailTemplate = (name: string, planName: string, expiryDate: string, daysUntilExpiry: number) => {
    let renewalMessage = '';
    if (daysUntilExpiry > 1) {
        renewalMessage = `Your subscription to the <strong>${planName}</strong> plan is expiring in ${daysUntilExpiry} days on <strong>${expiryDate}</strong>.`;
    } else if (daysUntilExpiry === 1) {
        renewalMessage = `This is a final reminder that your subscription to the <strong>${planName}</strong> plan will expire tomorrow, <strong>${expiryDate}</strong>.`;
    } else {
        renewalMessage = `Your subscription to the <strong>${planName}</strong> plan has expired today, <strong>${expiryDate}</strong>.`;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
            .header { background-color: #FFC107; padding: 40px; text-align: center; color: #333; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px; color: #333333; line-height: 1.6; }
            .button { display: inline-block; background-color: #4CAF50; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
            .footer p { margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Subscription Renewal Reminder</h1>
            </div>
            <div class="content">
                <p>Hello, ${name.split(' ')[0]},</p>
                <p>${renewalMessage}</p>
                <p>To ensure uninterrupted access to your personalized diet plans and our services, please renew your subscription at your earliest convenience.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/renew" class="button">Renew Your Subscription Now</a>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
                <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
};


const sendRenewalEmailFlow = ai.defineFlow({
    name: 'sendRenewalEmailFlow',
    inputSchema: z.object({
        name: z.string(),
        email: z.string().email(),
        planName: z.string(),
        expiryDate: z.string(),
        daysUntilExpiry: z.number(),
    }),
    outputSchema: z.void(),
}, async (input) => {
    const { name, email, planName, expiryDate, daysUntilExpiry } = input;
    
    if (!process.env.SMTP_HOST) {
        console.warn("SMTP settings not configured. Skipping renewal email.");
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

    const subject = `Your Subscription is Expiring Soon!`;
    const html = createRenewalEmailTemplate(name, planName, expiryDate, daysUntilExpiry);

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Renewal reminder sent to ${email}`);
    } catch (error) {
        console.error("Error sending renewal email:", error);
    }
});


export const sendRenewalReminders = ai.defineFlow(
    {
      name: 'sendRenewalReminders',
      inputSchema: z.object({ daysOut: z.array(z.number()) }).optional(),
      outputSchema: z.object({ sent: z.number() }),
    },
    async (input) => {
        if (!db) {
            throw new Error("Firebase Admin SDK not initialized.");
        }

        const settingsDoc = await db.collection('settings').doc('global').get();
        const messagingSettings = settingsDoc.exists ? settingsDoc.data()?.messagingSettings : {};
        const renewalConfig = messagingSettings?.renewalReminder;

        const daysToCheck = input?.daysOut || [0, 1, 2];
        let sentCount = 0;
        
        const processUsers = async (collectionName: 'customers' | 'vendors', userType: 'Customer' | 'Partner') => {
            for (const day of daysToCheck) {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + day);
                
                const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
                const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

                if (!db) continue;
                const q = db.collection(collectionName)
                    .where('subscriptionEndDate', '>=', Timestamp.fromDate(startOfDay))
                    .where('subscriptionEndDate', '<=', Timestamp.fromDate(endOfDay));
                
                const snapshot = await q.get();

                if (!snapshot.empty) {
                    console.log(`Found ${snapshot.docs.length} ${collectionName} with subscriptions expiring in ${day} day(s).`);

                    for (const doc of snapshot.docs) {
                        const user = doc.data();
                        let planName = 'N/A';
                        if (user.planId) {
                            const planDoc = await db.collection("subscriptionPlans").doc(user.planId).get();
                            if (planDoc.exists) {
                                planName = planDoc.data()!.name;
                            }
                        }

                        const expiryDateFormatted = format(user.subscriptionEndDate.toDate(), 'PPP');

                        await sendRenewalEmailFlow({
                            name: user.name,
                            email: user.email,
                            planName,
                            expiryDate: expiryDateFormatted,
                            daysUntilExpiry: day,
                        });
                        
                        sendTransactionalEmail({
                            template: 'adminRenewalReminder',
                            name: user.name,
                            email: user.email,
                            userType: userType,
                            planName: planName,
                            daysLeft: day,
                        }).catch(console.error);

                        if (renewalConfig?.templateName && user.mobile) {
                             const templateData = {
                                customerName: user.name.split(' ')[0],
                                planName: planName,
                                expiryDate: expiryDateFormatted,
                            };
                            
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
                            const vars = getOrderedVars(renewalConfig, templateData);
                            await sendWhatsAppMessage({ templateName: renewalConfig.templateName, recipient: user.mobile, variables: vars });
                        }
                        sentCount++;
                    }
                }
            }
        };
        
        await processUsers('customers', 'Customer');
        await processUsers('vendors', 'Partner');

        return { sent: sentCount };
    }
);
