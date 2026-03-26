import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getWhatsAppServiceWithSettings } from '@/lib/whatsapp-service';

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber } = await req.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Normalize phone number (REMOVE ALL NON-DIGITS for WhatsApp API)
        const normalizedPhone = phoneNumber.replace(/\D/g, '');

        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
        }

        // 1. Check if user exists in Firestore customers collection
        const customersRef = db!.collection('customers');
        const last10Digits = normalizedPhone.slice(-10);
        
        // We try multiple common formats to be as flexible as possible
        const formatsToTry = [
            normalizedPhone,           // e.g. 919876543210
            `+${normalizedPhone}`,      // e.g. +919876543210
            last10Digits,               // e.g. 9876543210 (local format)
            `+${last10Digits}`          // e.g. +9876543210
        ];

        let snapshot = { empty: true } as any;
        for (const format of formatsToTry) {
            if (!format) continue;
            snapshot = await customersRef.where('mobile', '==', format).get();
            if (!snapshot.empty) break;
        }

        if (snapshot.empty) {
            return NextResponse.json({ 
                error: 'This mobile number is not registered. Please use your registered mobile number.' 
            }, { status: 404 });
        }

        const customerDoc = snapshot.docs[0];
        const customerData = customerDoc.data();

        // 2. Prepare WhatsApp service
        const whatsapp = await getWhatsAppServiceWithSettings();

        // 3. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 4. Store OTP
        await db!.collection('login_otps').doc(normalizedPhone).set({
            otp,
            expiresAt,
            userId: customerDoc.id,
            email: customerData.email
        });

        // 5. Send OTP via WhatsApp
        // Using the 'client_login_code' template which should have one body parameter for the code
        try {
            await whatsapp.sendTemplateMessage({
                to: normalizedPhone,
                templateName: 'client_login_code_2',
                language: 'en_US',
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: otp }
                        ]
                    },
                    // If the template has a button with otp_type, we might need to add it here
                    // But usually for authentication templates, Meta handles the button automatically
                    // if it was created as an AUTHENTICATION template.
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
        } catch (sendError: any) {
             console.error('WhatsApp Send Error:', sendError);
             return NextResponse.json({ 
                error: 'Failed to send WhatsApp verification code. Please check your number or try again later.' 
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'OTP sent successfully' });

    } catch (error: any) {
        console.error('WhatsApp Auth Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
