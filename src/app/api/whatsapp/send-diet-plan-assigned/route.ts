import { NextResponse } from 'next/server';
import { sendDietPlanAssigned } from '@/lib/whatsapp-helpers';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { phone, name, userId, assignedBy, planDetails } = body;

        if (!phone || !name || !userId || !assignedBy || !planDetails) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        await sendDietPlanAssigned({
            phone,
            name,
            userId,
            assignedBy,
            planDetails,
        });

        return NextResponse.json({
            success: true,
            message: 'WhatsApp message sent successfully',
        });
    } catch (error: any) {
        console.error('Error sending WhatsApp message:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send WhatsApp message' },
            { status: 500 }
        );
    }
}
