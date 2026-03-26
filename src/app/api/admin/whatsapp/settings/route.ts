import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");

        const settingsDoc = await db.collection('whatsappSettings').doc('global').get();

        if (!settingsDoc.exists) {
            return NextResponse.json({
                isConfigured: false,
                isEnabled: false,
            });
        }

        const data = settingsDoc.data();
        if (!data) {
            return NextResponse.json({
                isConfigured: false,
                isEnabled: false,
            });
        }

        // Don't send sensitive data to client
        return NextResponse.json({
            isConfigured: data.isConfigured || false,
            isEnabled: data.isEnabled || false,
            phoneNumber: data.phoneNumber || '',
            phoneNumberVerified: data.phoneNumberVerified || false,
            appId: data.appId || '',
            businessAccountId: data.businessAccountId || '',
            phoneNumberId: data.phoneNumberId || '',
            webhookVerifyToken: data.webhookVerifyToken || '',
            accessToken: data.accessToken || '',
        });
    } catch (error: any) {
        console.error('Error fetching WhatsApp settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const body = await req.json();

        const {
            accessToken,
            phoneNumberId,
            businessAccountId,
            appId,
            webhookVerifyToken,
        } = body;

        if (!accessToken || !phoneNumberId || !businessAccountId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Save to Firestore (encrypted in production)
        await db.collection('whatsappSettings').doc('global').set({
            accessToken,
            phoneNumberId,
            businessAccountId,
            appId: appId || '',
            webhookVerifyToken: webhookVerifyToken || '',
            isConfigured: true,
            isEnabled: false, // Admin needs to enable after testing
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return NextResponse.json({
            success: true,
            message: 'Settings saved successfully',
        });
    } catch (error: any) {
        console.error('Error saving WhatsApp settings:', error);
        return NextResponse.json(
            { error: 'Failed to save settings' },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const body = await req.json();
        const { isEnabled } = body;

        await db.collection('whatsappSettings').doc('global').set({
            isEnabled: isEnabled === true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return NextResponse.json({
            success: true,
            message: `WhatsApp ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        });
    } catch (error: any) {
        console.error('Error updating WhatsApp settings:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
