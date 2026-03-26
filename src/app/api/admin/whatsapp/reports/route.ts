import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");

        // Fetch all logs for basic stats
        // In a real production app, you might want to aggregate these periodically
        const snapshot = await db.collection('whatsappMessageLogs').get();

        const logs = snapshot.docs.map(doc => doc.data());
        const totalSent = logs.length;
        const delivered = logs.filter(l => l.status === 'delivered' || l.status === 'read').length;
        const read = logs.filter(l => l.status === 'read').length;
        const failed = logs.filter(l => l.status === 'failed').length;

        const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
        const readRate = totalSent > 0 ? (read / totalSent) * 100 : 0;

        return NextResponse.json({
            overview: {
                totalSent,
                delivered,
                read,
                failed,
                deliveryRate: Math.round(deliveryRate),
                readRate: Math.round(readRate),
            },
            // You could add daily stats here
        });
    } catch (error: any) {
        console.error('Error fetching reports:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
