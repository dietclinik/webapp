import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp-helpers';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, toName, toUserId, templateName, language, components, metadata } = body;

        if (!to || !toName || !templateName) {
            return NextResponse.json(
                { error: 'Missing required fields: to, toName, templateName' },
                { status: 400 }
            );
        }

        const result = await sendWhatsAppMessage({
            to,
            toName,
            toUserId,
            templateName,
            language,
            components,
            metadata,
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
            });
        } else {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Send message error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send message' },
            { status: 500 }
        );
    }
}
