import { getWhatsAppService } from './whatsapp-service';
import { db, admin } from './firebase-admin';

export interface MessageLog {
    messageId?: string;
    toPhone: string;
    toName: string;
    toUserId?: string | null;
    templateName: string;
    templateId?: string;
    messageType: 'template' | 'text';
    status: 'sent' | 'delivered' | 'read' | 'failed';
    errorMessage?: string;
    metadata?: any;
    sentAt: any;
    deliveredAt?: any;
    readAt?: any;
}

/**
 * Send WhatsApp message and log it
 */
export async function sendWhatsAppMessage(params: {
    to: string;
    toName: string;
    toUserId?: string;
    templateName: string;
    language?: string;
    components?: any[];
    metadata?: any;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        if (!db) throw new Error("Database not initialized");
        const { getWhatsAppServiceWithSettings } = await import('./whatsapp-service');
        const whatsappService = await getWhatsAppServiceWithSettings();

        // Send message
        const response = await whatsappService.sendTemplateMessage({
            to: params.to,
            templateName: params.templateName,
            language: params.language || 'en',
            components: params.components,
        });

        const messageId = response.messages[0]?.id;

        // Log to Firestore
        const logData: MessageLog = {
            messageId,
            toPhone: params.to,
            toName: params.toName,
            toUserId: params.toUserId || null,
            templateName: params.templateName,
            messageType: 'template',
            status: 'sent',
            metadata: params.metadata || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('whatsappMessageLogs').add(logData);

        return { success: true, messageId };
    } catch (error: any) {
        console.error('WhatsApp message send error:', error);

        // Log failed message
        try {
            if (db) {
                const logData: MessageLog = {
                    toPhone: params.to,
                    toName: params.toName,
                    toUserId: params.toUserId || null,
                    templateName: params.templateName,
                    messageType: 'template',
                    status: 'failed',
                    errorMessage: error.message,
                    metadata: params.metadata || null,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                await db.collection('whatsappMessageLogs').add(logData);
            }
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        return { success: false, error: error.message };
    }
}

/**
 * Send welcome message to customer
 */
export async function sendWelcomeCustomer(params: {
    phone: string;
    name: string;
    userId: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'welcome_customer',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                ],
            },
        ],
        metadata: { type: 'welcome', userType: 'customer' },
    });
}

/**
 * Send welcome message to staff
 */
export async function sendWelcomeStaff(params: {
    phone: string;
    name: string;
    userId: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'welcome_staff',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                ],
            },
        ],
        metadata: { type: 'welcome', userType: 'staff' },
    });
}

/**
 * Send welcome message to partner
 */
export async function sendWelcomePartner(params: {
    phone: string;
    name: string;
    userId: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'welcome_partner',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                ],
            },
        ],
        metadata: { type: 'welcome', userType: 'partner' },
    });
}

/**
 * Send subscription details
 */
export async function sendSubscriptionDetails(params: {
    phone: string;
    name: string;
    userId: string;
    planName: string;
    duration: string;
    startDate: string;
    endDate: string;
    amount: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'subscription_details',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                    { type: 'text', text: params.planName },
                    { type: 'text', text: params.duration },
                    { type: 'text', text: params.startDate },
                    { type: 'text', text: params.endDate },
                    { type: 'text', text: params.amount },
                ],
            },
        ],
        metadata: { type: 'subscription', planName: params.planName },
    });
}

/**
 * Send renewal reminder
 */
export async function sendRenewalReminder(params: {
    phone: string;
    name: string;
    userId: string;
    planName: string;
    expiryDate: string;
    daysRemaining: number;
}) {
    const templateMap: { [key: number]: string } = {
        7: 'renewal_reminder_7days',
        3: 'renewal_reminder_3days',
        0: 'renewal_reminder_today',
        '-2': 'renewal_reminder_overdue',
    };

    const templateName = templateMap[params.daysRemaining] || 'renewal_reminder_7days';

    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName,
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                    { type: 'text', text: params.planName },
                    { type: 'text', text: params.expiryDate },
                ],
            },
        ],
        metadata: { type: 'renewal_reminder', daysRemaining: params.daysRemaining },
    });
}

/**
 * Send plan expired notification
 */
export async function sendPlanExpired(params: {
    phone: string;
    name: string;
    userId: string;
    planName: string;
    expiredDate: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'plan_expired',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                    { type: 'text', text: params.planName },
                    { type: 'text', text: params.expiredDate },
                ],
            },
        ],
        metadata: { type: 'plan_expired' },
    });
}

/**
 * Send diet plan assigned notification
 */
export async function sendDietPlanAssigned(params: {
    phone: string;
    name: string;
    userId: string;
    assignedBy: string;
    planDetails: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'diet_plan_assigned',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                    { type: 'text', text: params.assignedBy },
                    { type: 'text', text: params.planDetails },
                ],
            },
        ],
        metadata: { type: 'diet_plan_assigned', assignedBy: params.assignedBy },
    });
}

/**
 * Send body measurements and calculations
 */
export async function sendBodyMeasurements(params: {
    phone: string;
    name: string;
    userId: string;
    bmi: string;
    bmr: string;
    bodyFat: string;
    protein: string;
    carbs: string;
    fats: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'body_measurements',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                    { type: 'text', text: params.bmi },
                    { type: 'text', text: params.bmr },
                    { type: 'text', text: params.bodyFat },
                    { type: 'text', text: params.protein },
                    { type: 'text', text: params.carbs },
                    { type: 'text', text: params.fats },
                ],
            },
        ],
        metadata: { type: 'body_measurements' },
    });
}

/**
 * Send daily diet log reminder
 */
export async function sendDietLogReminder(params: {
    phone: string;
    name: string;
    userId: string;
}) {
    return sendWhatsAppMessage({
        to: params.phone,
        toName: params.name,
        toUserId: params.userId,
        templateName: 'diet_log_reminder',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: params.name },
                ],
            },
        ],
        metadata: { type: 'diet_log_reminder' },
    });
}

/**
 * Update message status in logs
 */
export async function updateMessageStatus(params: {
    messageId: string;
    status: 'delivered' | 'read' | 'failed';
    errorMessage?: string;
}) {
    try {
        if (!db) throw new Error("Database not initialized");
        const logsRef = db.collection('whatsappMessageLogs');
        // Find document by messageId
        const snapshot = await logsRef.where('messageId', '==', params.messageId).get();

        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const updateData: any = {
                status: params.status,
            };

            if (params.status === 'delivered') {
                updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
            } else if (params.status === 'read') {
                updateData.readAt = admin.firestore.FieldValue.serverTimestamp();
            } else if (params.status === 'failed' && params.errorMessage) {
                updateData.errorMessage = params.errorMessage;
            }

            await docRef.update(updateData);
        }
    } catch (error) {
        console.error('Failed to update message status:', error);
    }
}
