
'use server';
/**
 * @fileOverview A dedicated flow for sending all transactional emails.
 *
 * - sendTransactionalEmail - Handles sending various email templates.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const createWelcomeEmailTemplate = (name: string, email: string, password: string, bmiValue?: string, bmiMessage?: string) => `
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
            ${bmiValue && bmiMessage ? `<p>As a starting point, your calculated Body Mass Index (BMI) is <strong>${bmiValue}</strong>, which is considered <strong>${bmiMessage}</strong>. We'll use this as a baseline to track your amazing progress.</p>` : ''}
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="button">Go to Your Dashboard</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;

const createPartnerWelcomeEmailTemplate = (name: string, email: string, password: string) => `
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
            <p>We are excited to partner with you! Your Partner account has been created.</p>
            <p>You can use the following credentials to log in to the partner portal:</p>
            <div class="credentials-box">
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #007bff; text-decoration: none;">${email}</a></p>
                <p><strong>Temporary Password:</strong></p>
                <p style="word-wrap: break-word; font-family: monospace;">${password}</p>
            </div>
            <p>Please change this password after your first login.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/partner/login" class="button">Go to Partner Portal</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;


const createUpgradeSuccessEmailTemplate = (name: string, planName: string) => `
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
        .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Plan Upgraded Successfully!</h1>
        </div>
        <div class="content">
            <p>Hello ${name.split(' ')[0]},</p>
            <p>Congratulations! Your subscription has been successfully upgraded to the <strong>${planName}</strong> plan.</p>
            <p>We're excited for you to enjoy the new features and benefits. Thank you for continuing your health journey with us!</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="button">Go to Your Dashboard</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;

const createPaymentFailedEmailTemplate = (name: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
        .header { background-color: #DC3545; padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .button { display: inline-block; background-color: #FFC107; color: #000000; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Failed</h1>
        </div>
        <div class="content">
            <p>Hello, ${name.split(' ')[0]},</p>
            <p>We noticed that your payment failed or was not completed. Your details have been saved, but your account is not yet active.</p>
            <p>Please try the payment again or contact our support team if you face any issues. You can retry by visiting our plans page.</p>
             <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/#plans" class="button">View Plans</a>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;

const createAdminNotificationEmailTemplate = (customerName: string, email: string, planName: string, paymentStatus: string) => `
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
        .info-box { background-color: #f8f9fa; border-left: 4px solid #17A2B8; padding: 20px; margin: 20px 0; }
        .info-box ul { list-style: none; padding: 0; margin: 0; }
        .info-box li { margin-bottom: 10px; }
        .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Customer Registration</h1>
        </div>
        <div class="content">
            <p>A new customer has registered on the portal.</p>
             <div class="info-box">
                <ul>
                    <li><strong>Name:</strong> ${customerName}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Plan:</strong> ${planName}</li>
                    <li><strong>Payment Status:</strong> ${paymentStatus}</li>
                </ul>
            </div>
        </div>
         <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <p>App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" style="color: #FFC107; text-decoration: none;">Catchy Technologies</a></p>
        </div>
    </div>
</body>
</html>
`;

const createAdminPartnerRegEmailTemplate = (partnerName: string, email: string, planName: string, paymentStatus: string) => `
<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background-color:#f0f2f5;padding:20px;}.container{max-width:600px;margin:auto;background-color:#fff;border-radius:8px;}.header{background-color:#007bff;padding:40px;text-align:center;color:white;}.content{padding:30px;color:#333;line-height:1.6;}.info-box{background-color:#f8f9fa;border-left:4px solid #007bff;padding:20px;margin:20px 0;}ul{list-style:none;padding:0;}li{margin-bottom:10px;}.footer{background-color:#333;color:#aaa;padding:20px;text-align:center;font-size:12px;}</style></head><body><div class="container"><div class="header"><h1>New Partner Registration</h1></div><div class="content"><p>A new partner has registered.</p><div class="info-box"><ul><li><strong>Name:</strong> ${partnerName}</li><li><strong>Email:</strong> ${email}</li><li><strong>Plan:</strong> ${planName}</li><li><strong>Payment Status:</strong> ${paymentStatus}</li></ul></div></div></div></body></html>`;

const createAdminContactSubmissionEmailTemplate = (name: string, email: string, mobile: string, subject: string, message: string) => `
<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background-color:#f0f2f5;padding:20px;}.container{max-width:600px;margin:auto;background-color:#fff;border-radius:8px;}.header{background-color:#6c757d;padding:40px;text-align:center;color:white;}.content{padding:30px;color:#333;line-height:1.6;}.info-box{background-color:#f8f9fa;border-left:4px solid #6c757d;padding:20px;margin:20px 0;}.footer{background-color:#333;color:#aaa;padding:20px;text-align:center;font-size:12px;}</style></head><body><div class="container"><div class="header"><h1>New Contact Form Submission</h1></div><div class="content"><div class="info-box"><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mobile:</strong> ${mobile}</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong></p><p>${message}</p></div></div></div></body></html>`;

const createAdminDietPlanAssignedEmailTemplate = (customerName: string, planName: string, assignerName: string) => `
<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background-color:#f0f2f5;padding:20px;}.container{max-width:600px;margin:auto;background-color:#fff;border-radius:8px;}.header{background-color:#28a745;padding:40px;text-align:center;color:white;}.content{padding:30px;color:#333;line-height:1.6;}</style></head><body><div class="container"><div class="header"><h1>Diet Plan Assigned</h1></div><div class="content"><p>A diet plan has been assigned:</p><ul><li><strong>Customer:</strong> ${customerName}</li><li><strong>Plan:</strong> ${planName}</li><li><strong>Assigned By:</strong> ${assignerName}</li></ul></div></div></body></html>`;

const createAdminRenewalReminderEmailTemplate = (userName: string, userType: string, planName: string, daysLeft: number) => `
<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background-color:#f0f2f5;padding:20px;}.container{max-width:600px;margin:auto;background-color:#fff;border-radius:8px;}.header{background-color:#ffc107;padding:40px;text-align:center;color:#212529;}.content{padding:30px;color:#333;line-height:1.6;}</style></head><body><div class="container"><div class="header"><h1>Subscription Reminder</h1></div><div class="content"><p>This is a reminder that a ${userType}'s subscription is expiring soon:</p><ul><li><strong>Name:</strong> ${userName}</li><li><strong>Plan:</strong> ${planName}</li><li><strong>Expires in:</strong> ${daysLeft} day(s)</li></ul></div></div></body></html>`;


export const sendTransactionalEmail = ai.defineFlow({
    name: 'sendTransactionalEmail',
    inputSchema: z.object({
        name: z.string(),
        email: z.string().email(),
        template: z.enum(['welcome', 'partnerWelcome', 'paymentFailed', 'adminNotification', 'renewalSuccess', 'upgradeSuccess', 'adminPartnerRegistration', 'adminContactSubmission', 'adminDietPlanAssigned', 'adminRenewalReminder']),
        password: z.string().optional(),
        planName: z.string().optional(),
        paymentStatus: z.string().optional(),
        bmiValue: z.string().optional(),
        bmiMessage: z.string().optional(),
        // For contact form
        mobile: z.string().optional(),
        subject: z.string().optional(),
        message: z.string().optional(),
        // For diet plan assignment
        assignerName: z.string().optional(),
        // For renewal reminder
        userType: z.string().optional(),
        daysLeft: z.number().optional(),
    }),
    outputSchema: z.void(),
}, async (input) => {
    const { name, email, template, password, planName, paymentStatus, bmiValue, bmiMessage, mobile, subject, message, assignerName, userType, daysLeft } = input;

    if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAIL) {
        console.warn("SMTP settings or Admin Email are not configured. Skipping email.");
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

    let mailSubject = '';
    let html = '';
    let to = email;

    switch (template) {
        case 'welcome':
            mailSubject = 'Welcome to Your Health Journey!';
            html = createWelcomeEmailTemplate(name, email, password!, bmiValue, bmiMessage);
            break;
        case 'partnerWelcome':
            mailSubject = 'Welcome to the Diet Clinik Partner Network!';
            html = createPartnerWelcomeEmailTemplate(name, email, password!);
            break;
        case 'paymentFailed':
            mailSubject = 'Your Payment Was Unsuccessful';
            html = createPaymentFailedEmailTemplate(name);
            break;
        case 'adminNotification':
            to = process.env.ADMIN_EMAIL!;
            mailSubject = `New Customer Registration: ${name}`;
            html = createAdminNotificationEmailTemplate(name, email, planName!, paymentStatus!);
            break;
        case 'renewalSuccess':
            mailSubject = 'Your Subscription Has Been Renewed!';
            html = `<p>Hello ${name},</p><p>Your subscription to the ${planName} plan has been successfully renewed.</p>`;
            break;
        case 'upgradeSuccess':
            mailSubject = 'Your Plan Has Been Upgraded!';
            html = createUpgradeSuccessEmailTemplate(name, planName!);
            break;
        case 'adminPartnerRegistration':
            to = process.env.ADMIN_EMAIL!;
            mailSubject = `New Partner Registration: ${name}`;
            html = createAdminPartnerRegEmailTemplate(name, email, planName!, paymentStatus!);
            break;
        case 'adminContactSubmission':
            to = process.env.ADMIN_EMAIL!;
            mailSubject = `New Contact Form Submission: ${subject}`;
            html = createAdminContactSubmissionEmailTemplate(name, email, mobile!, subject!, message!);
            break;
        case 'adminDietPlanAssigned':
            to = process.env.ADMIN_EMAIL!;
            mailSubject = `Diet Plan Assigned to ${name}`;
            html = createAdminDietPlanAssignedEmailTemplate(name, planName!, assignerName!);
            break;
        case 'adminRenewalReminder':
            to = process.env.ADMIN_EMAIL!;
            mailSubject = `${userType} Subscription Reminder: ${name}`;
            html = createAdminRenewalReminderEmailTemplate(name, userType!, planName!, daysLeft!);
            break;
    }
    
    if (!to) {
        console.error(`No recipient address for template ${template}`);
        return;
    }

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Diet Clinik'}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: to,
        subject: mailSubject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to} with template ${template}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
});
