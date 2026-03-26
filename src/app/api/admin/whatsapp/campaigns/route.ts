import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const snapshot = await db.collection('whatsappCampaigns')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const campaigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as any)?.toDate?.()?.toISOString() || null,
            scheduledAt: (doc.data().scheduledAt as any)?.toDate?.()?.toISOString() || null,
            completedAt: (doc.data().completedAt as any)?.toDate?.()?.toISOString() || null,
        }));

        return NextResponse.json({ campaigns });
    } catch (error: any) {
        console.error('Error fetching campaigns:', error);
        return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!db) throw new Error("Database not initialized");
        const { name, templateId, targetAudience, scheduledAt } = body;

        if (!name || !templateId || !targetAudience) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const docRef = await db.collection('whatsappCampaigns').add({
            name,
            templateId,
            targetAudience,
            status: scheduledAt ? 'scheduled' : 'draft',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            sentCount: 0,
            deliveredCount: 0,
            failedCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            success: true,
            id: docRef.id,
            message: 'Campaign created successfully',
        });
    } catch (error: any) {
        console.error('Error creating campaign:', error);
        return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }
}
