import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getWhatsAppServiceWithSettings } from '@/lib/whatsapp-service';

type UserType = 'customer' | 'partner' | 'vendor' | 'admin';

const COLLECTION_MAP: Record<UserType, string> = {
    customer: 'customers',
    partner: 'vendors',
    vendor: 'vendors',
    admin: 'admins',
};

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber, userType = 'customer' } = await req.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const collection = COLLECTION_MAP[userType as UserType];
        if (!collection) {
            return NextResponse.json({ error: 'Invalid user type' }, { status: 400 });
        }

        // Normalize phone number (remove all non-digits)
        const normalizedPhone = phoneNumber.replace(/\D/g, '');

        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
        }

        // Check if user exists — try multiple number formats for flexibility
        const collectionRef = db!.collection(collection);
        const last10Digits = normalizedPhone.slice(-10);

        const formatsToTry = [
            normalizedPhone,
            `+${normalizedPhone}`,
            last10Digits,
            `+${last10Digits}`,
        ];

        let snapshot = { empty: true } as any;
        for (const format of formatsToTry) {
            if (!format) continue;
            snapshot = await collectionRef.where('mobile', '==', format).get();
            if (!snapshot.empty) break;
        }

        if (snapshot.empty) {
            return NextResponse.json({
                error: 'This mobile number is not registered. Please use your registered mobile number.'
            }, { status: 404 });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Prepare WhatsApp service
        const whatsapp = await getWhatsAppServiceWithSettings();

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP
        await db!.collection('login_otps').doc(normalizedPhone).set({
            otp,
            expiresAt,
            userId: userDoc.id,
            email: userData.email ?? null,
            userType,
        });

        // Send OTP via WhatsApp
        let otpSent = false;
        let lastError: any = null;

        // Attempt 1: Template with body + button components
        try {
            await whatsapp.sendTemplateMessage({
                to: normalizedPhone,
                templateName: 'client_login_code_2',
                language: 'en',
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: otp }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            { type: 'text', text: otp }
                        ]
                    }
                ]
            });
            otpSent = true;
        } catch (templateError: any) {
            lastError = templateError;
            console.error('WhatsApp template send failed, trying text fallback:', templateError.message);
        }

        // Attempt 2: Plain text fallback (works within 24-hour customer service window)
        if (!otpSent) {
            try {
                await whatsapp.sendTextMessage(
                    normalizedPhone,
                    `Your DietClinik login verification code is: *${otp}*\n\nThis code is valid for 10 minutes. Do not share this code with anyone.`
                );
                otpSent = true;
            } catch (textError: any) {
                lastError = textError;
                console.error('WhatsApp text fallback also failed:', textError.message);
            }
        }

        if (!otpSent) {
            console.error('All WhatsApp send attempts failed. Last error:', lastError);
            return NextResponse.json({
                error: `Failed to send WhatsApp verification code. ${lastError?.message || 'Unknown error'}`
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'OTP sent successfully' });

    } catch (error: any) {
        console.error('WhatsApp Auth Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
