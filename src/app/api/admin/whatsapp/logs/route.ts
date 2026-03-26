import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        if (!db) throw new Error("Database not initialized");

        const pageSize = parseInt(searchParams.get('limit') || '20');
        const lastDocId = searchParams.get('lastDoc');
        const status = searchParams.get('status');

        let q: any = db.collection('whatsappMessageLogs')
            .orderBy('sentAt', 'desc')
            .limit(pageSize);

        if (status) {
            q = q.where('status', '==', status);
        }

        if (lastDocId) {
            const lastDocSnap = await db.collection('whatsappMessageLogs').doc(lastDocId).get();
            if (lastDocSnap.exists) {
                q = q.startAfter(lastDocSnap);
            }
        }

        const snapshot = await q.get();
        const logs = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
            sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
            deliveredAt: doc.data().deliveredAt?.toDate?.()?.toISOString() || null,
            readAt: doc.data().readAt?.toDate?.()?.toISOString() || null,
        }));

        return NextResponse.json({
            logs,
            hasMore: snapshot.docs.length === pageSize,
            lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id,
        });
    } catch (error: any) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
