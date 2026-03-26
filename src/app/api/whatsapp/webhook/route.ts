import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { WebhookPayload } from '@/lib/whatsapp-service';

// Webhook verification (GET request from Meta)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    try {
        const { db } = await import('@/components/firebase-provider');

        // Get verify token from settings
        const settingsRef = doc(db, 'whatsappSettings', 'global');
        const settingsDoc = await getDoc(settingsRef);

        if (!settingsDoc.exists()) {
            return NextResponse.json({ error: 'Not configured' }, { status: 403 });
        }

        const settings = settingsDoc.data();
        const verifyToken = settings.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('Webhook verified');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
        }
    } catch (error) {
        console.error('Webhook verification error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
    }
}

// Webhook handler (POST request from Meta)
export async function POST(req: Request) {
    try {
        const body: WebhookPayload = await req.json();
        const { db } = await import('@/components/firebase-provider');

        // Process webhook payload
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    // Handle incoming messages
                    if (change.value.messages) {
                        for (const message of change.value.messages) {
                            const contact = change.value.contacts?.[0];

                            // Save to inbox
                            await addDoc(collection(db, 'whatsappInbox'), {
                                messageId: message.id,
                                fromPhone: message.from,
                                fromName: contact?.profile?.name || 'Unknown',
                                messageType: message.type,
                                messageContent: message.text?.body || '',
                                mediaUrl: message.image?.id || message.document?.id || message.video?.id || message.audio?.id || null,
                                timestamp: new Date(parseInt(message.timestamp) * 1000),
                                isRead: false,
                                replied: false,
                                createdAt: serverTimestamp(),
                            });
                        }
                    }

                    // Handle message status updates
                    if (change.value.statuses) {
                        for (const status of change.value.statuses) {
                            // Update message log status
                            const { updateMessageStatus } = await import('@/lib/whatsapp-helpers');
                            await updateMessageStatus({
                                messageId: status.id,
                                status: status.status as any,
                                errorMessage: status.errors?.[0]?.message,
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
}
