import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { initializeWhatsAppService } from '@/lib/whatsapp-service';

export async function POST(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");

        // Get settings from Firestore
        const settingsDoc = await db.collection('whatsappSettings').doc('global').get();

        if (!settingsDoc.exists) {
            return NextResponse.json(
                { error: 'WhatsApp not configured' },
                { status: 400 }
            );
        }

        const settings = settingsDoc.data();
        if (!settings) throw new Error("Settings data is empty");

        if (!settings.accessToken || !settings.phoneNumberId) {
            return NextResponse.json(
                { error: 'Incomplete configuration' },
                { status: 400 }
            );
        }

        // Initialize service and test connection
        const whatsappService = initializeWhatsAppService({
            accessToken: settings.accessToken,
            phoneNumberId: settings.phoneNumberId,
            businessAccountId: settings.businessAccountId,
            apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        });

        const isConnected = await whatsappService.testConnection();

        if (isConnected) {
            return NextResponse.json({
                success: true,
                message: 'Connection successful',
            });
        } else {
            return NextResponse.json(
                { error: 'Connection failed. Please check your credentials.' },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error('Error testing WhatsApp connection:', error);
        return NextResponse.json(
            { error: error.message || 'Connection test failed' },
            { status: 500 }
        );
    }
}
