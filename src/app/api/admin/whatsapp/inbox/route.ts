import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const { searchParams } = new URL(req.url);

        const pageSize = parseInt(searchParams.get('limit') || '20');
        const lastDocId = searchParams.get('lastDoc');
        const isRead = searchParams.get('isRead');

        let query = db.collection('whatsappInbox')
            .orderBy('timestamp', 'desc')
            .limit(pageSize);

        // Filter by read status if provided
        if (isRead !== null && isRead !== undefined) {
            query = query.where('isRead', '==', isRead === 'true');
        }

        // Pagination
        if (lastDocId) {
            const lastDocSnap = await db.collection('whatsappInbox').doc(lastDocId).get();
            if (lastDocSnap.exists) {
                query = query.startAfter(lastDocSnap);
            }
        }

        const snapshot = await query.get();
        const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
        });

        return NextResponse.json({
            messages,
            hasMore: snapshot.docs.length === pageSize,
            lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id || null,
        });
    } catch (error: any) {
        console.error('Error fetching inbox:', error);
        return NextResponse.json(
            { error: 'Failed to fetch inbox' },
            { status: 500 }
        );
    }
}
