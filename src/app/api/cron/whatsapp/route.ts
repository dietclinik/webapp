import { NextResponse } from 'next/server';
import { checkRenewalReminders, checkExpiredSubscriptions, sendDailyDietLogReminders } from '@/lib/whatsapp-automation';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const task = searchParams.get('task');
    const apiKey = searchParams.get('apiKey');

    // Basic security check - in production you'd use a more robust CRON_SECRET
    if (apiKey !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let result;
        switch (task) {
            case 'renewal':
                result = await checkRenewalReminders();
                break;
            case 'expiry':
                result = await checkExpiredSubscriptions();
                break;
            case 'diet_log':
                result = await sendDailyDietLogReminders();
                break;
            default:
                return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error(`Cron task ${task} failed:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
