import { NextResponse } from 'next/server';
import { getWhatsAppServiceWithSettings } from '@/lib/whatsapp-service';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const whatsappService = await getWhatsAppServiceWithSettings();
        
        // Convert File to Buffer for the service
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const handle = await whatsappService.uploadMediaHandle(
            buffer,
            file.type,
            file.name
        );

        return NextResponse.json({ success: true, handle });
    } catch (error: any) {
        console.error('Error uploading template media:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload media' },
            { status: 500 }
        );
    }
}
