import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { initializeWhatsAppService } from '@/lib/whatsapp-service';

export async function GET(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");

        // Get templates from Firestore
        const snapshot = await db.collection('whatsappTemplates').get();

        const templates = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                components: typeof data.components === 'string' ? JSON.parse(data.components) : (data.components || []),
            };
        });

        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Error fetching templates:', error);
        return NextResponse.json(
            { error: 'Failed to fetch templates' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const body = await req.json().catch(() => ({}));
        const { action, template: templateData } = body;

        // Initialize WhatsApp service
        const settingsDoc = await db.collection('whatsappSettings').doc('global').get();
        if (!settingsDoc.exists) {
            return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 });
        }
        const settings = settingsDoc.data();
        if (!settings) throw new Error("Settings data is empty");

        const whatsappService = initializeWhatsAppService({
            accessToken: settings.accessToken,
            phoneNumberId: settings.phoneNumberId,
            businessAccountId: settings.businessAccountId,
            appId: settings.appId,
            apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        });

        if (action === 'create' || action === 'resubmit') {
            if (!templateData) {
                return NextResponse.json({ error: 'Template data required' }, { status: 400 });
            }

            // If resubmitting, delete existing template on Meta first
            if (action === 'resubmit') {
                try {
                    await whatsappService.deleteTemplate(templateData.name);
                } catch (e: any) {
                    console.warn(`Note: Could not delete template ${templateData.name} before recreation (it might not exist):`, e.message);
                }
            }

            // Create on Meta
            const result = await whatsappService.createTemplate(templateData);

            // Save to Firestore as PENDING
            await db.collection('whatsappTemplates').doc(result.id).set({
                id: result.id,
                name: templateData.name,
                language: templateData.language,
                status: 'PENDING',
                category: templateData.category,
                components: JSON.stringify(templateData.components || []),
                actionType: templateData.actionType || '',
                isEnabled: templateData.isEnabled || false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return NextResponse.json({
                success: true,
                template: result,
                message: action === 'resubmit' ? 'Template resubmitted for approval' : 'Template submitted for approval',
            });
        }

        // Default action: Sync from Meta
        const metaTemplates = await whatsappService.fetchTemplates();
        const metaTemplateIds = new Set(metaTemplates.map(t => t.id));

        // Get current templates in Firestore to identify stale ones
        const currentSnapshot = await db.collection('whatsappTemplates').get();
        const batch = db.batch();
        const templatesRef = db.collection('whatsappTemplates');

        // Delete templates that are no longer in Meta
        for (const doc of currentSnapshot.docs) {
            if (!metaTemplateIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        }

        // Save new/updated templates to Firestore
        for (const template of metaTemplates) {
            const templateDoc = templatesRef.doc(template.id);
            batch.set(templateDoc, {
                id: template.id,
                name: template.name,
                language: template.language,
                status: template.status,
                category: template.category,
                components: JSON.stringify(template.components || []),
                actionType: '', // Admin will map this
                isEnabled: false, // Disabled by default
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            count: metaTemplates.length,
            message: `Synced ${metaTemplates.length} templates`,
        });
    } catch (error: any) {
        console.error('Error syncing templates:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync templates' },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const body = await req.json();
        const { templateId, actionType, isEnabled } = body;

        if (!templateId) {
            return NextResponse.json(
                { error: 'Template ID required' },
                { status: 400 }
            );
        }

        const templateRef = db.collection('whatsappTemplates').doc(templateId);
        const updateData: any = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (actionType !== undefined) {
            updateData.actionType = actionType;
        }

        if (isEnabled !== undefined) {
            updateData.isEnabled = isEnabled;
        }

        await templateRef.set(updateData, { merge: true });

        return NextResponse.json({
            success: true,
            message: 'Template updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating template:', error);
        return NextResponse.json(
            { error: 'Failed to update template' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        if (!db) throw new Error("Database not initialized");
        const { searchParams } = new URL(req.url);
        const templateId = searchParams.get('id');
        const templateName = searchParams.get('name');

        if (!templateId || !templateName) {
            return NextResponse.json({ error: 'Template ID and Name are required' }, { status: 400 });
        }

        // Initialize WhatsApp service
        const settingsDoc = await db.collection('whatsappSettings').doc('global').get();
        const settings = settingsDoc.data();
        const whatsappService = initializeWhatsAppService({
            accessToken: settings?.accessToken,
            phoneNumberId: settings?.phoneNumberId,
            businessAccountId: settings?.businessAccountId,
            appId: settings?.appId,
            apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        });

        // Delete from Meta
        try {
            await whatsappService.deleteTemplate(templateName);
        } catch (error: any) {
            console.error('Error deleting from Meta:', error);
        }

        // Delete from Firestore
        await db.collection('whatsappTemplates').doc(templateId).delete();

        return NextResponse.json({ success: true, message: 'Template deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting template:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete template' },
            { status: 500 }
        );
    }
}
