import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { phoneNumber, otp } = await req.json();

        // Normalize phone number (REMOVE ALL NON-DIGITS)
        const normalizedPhone = phoneNumber.replace(/\D/g, '');

        if (!normalizedPhone || !otp) {
            return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 });
        }

        // 1. Retrieve OTP from Firestore
        const otpDoc = await db!.collection('login_otps').doc(normalizedPhone).get();
        if (!otpDoc.exists) {
            return NextResponse.json({ error: 'No OTP found for this number. Please request a new code.' }, { status: 404 });
        }

        const otpData = otpDoc.data()!;
        
        // 2. Check if OTP matches
        if (otpData.otp !== otp) {
            return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 401 });
        }

        // 3. Check if OTP is expired
        const now = new Date();
        const expiresAt = otpData.expiresAt.toDate();
        if (now > expiresAt) {
            return NextResponse.json({ error: 'OTP has expired. Please request a new code.' }, { status: 410 });
        }

        // 4. Generate Firebase Custom Token
        const customToken = await auth!.createCustomToken(otpData.userId);

        // 5. Delete the OTP after successful verification
        await db!.collection('login_otps').doc(normalizedPhone).delete();

        return NextResponse.json({ 
            success: true, 
            token: customToken,
            message: 'OTP verified successfully' 
        });

    } catch (error: any) {
        console.error('WhatsApp Verification Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
