// WhatsApp Business API Service Layer
// Handles all interactions with Meta's WhatsApp Cloud API

export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    appId?: string;
    apiVersion: string;
}

export interface SendTemplateParams {
    to: string;
    templateName: string;
    language?: string;
    components?: TemplateComponent[];
}

export interface TemplateComponent {
    type: 'header' | 'body' | 'button';
    sub_type?: 'url' | 'quick_reply';
    index?: string | number;
    parameters: TemplateParameter[];
}

export interface TemplateParameter {
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: {
        fallback_value: string;
        code: string;
        amount_1000: number;
    };
    date_time?: {
        fallback_value: string;
    };
    image?: {
        link: string;
    };
    document?: {
        link: string;
        filename?: string;
    };
    video?: {
        link: string;
    };
}

export interface MessageResponse {
    messaging_product: string;
    contacts: Array<{
        input: string;
        wa_id: string;
    }>;
    messages: Array<{
        id: string;
    }>;
}

export interface Template {
    id: string;
    name: string;
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    components: any[];
}

export interface WebhookPayload {
    object: string;
    entry: WebhookEntry[];
}

export interface WebhookEntry {
    id: string;
    changes: WebhookChange[];
}

export interface WebhookChange {
    value: {
        messaging_product: string;
        metadata: {
            display_phone_number: string;
            phone_number_id: string;
        };
        contacts?: Array<{
            profile: {
                name: string;
            };
            wa_id: string;
        }>;
        messages?: Array<{
            from: string;
            id: string;
            timestamp: string;
            type: 'text' | 'image' | 'document' | 'audio' | 'video';
            text?: {
                body: string;
            };
            image?: {
                mime_type: string;
                sha256: string;
                id: string;
            };
            document?: {
                filename: string;
                mime_type: string;
                sha256: string;
                id: string;
            };
            audio?: {
                mime_type: string;
                sha256: string;
                id: string;
                voice: boolean;
            };
            video?: {
                mime_type: string;
                sha256: string;
                id: string;
            };
        }>;
        statuses?: Array<{
            id: string;
            status: 'sent' | 'delivered' | 'read' | 'failed';
            timestamp: string;
            recipient_id: string;
            errors?: Array<{
                code: number;
                title: string;
                message: string;
            }>;
        }>;
    };
    field: string;
}

class WhatsAppService {
    private config: WhatsAppConfig;
    private baseUrl: string;

    constructor(config: WhatsAppConfig) {
        this.config = config;
        this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`;
    }

    /**
     * Send a template message
     */
    async sendTemplateMessage(params: SendTemplateParams): Promise<MessageResponse> {
        const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'template',
            template: {
                name: params.templateName,
                language: {
                    code: params.language || 'en',
                },
                components: params.components || [],
            },
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /**
     * Send a text message (requires 24-hour window)
     */
    async sendTextMessage(to: string, text: string): Promise<MessageResponse> {
        const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: text,
            },
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /**
     * Fetch message templates from Meta
     */
    async fetchTemplates(): Promise<Template[]> {
        const url = `${this.baseUrl}/${this.config.businessAccountId}/message_templates`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    }

    /**
     * Create a message template on Meta
     */
    async createTemplate(params: any): Promise<any> {
        const url = `${this.baseUrl}/${this.config.businessAccountId}/message_templates`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
                },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /**
     * Delete a message template on Meta
     */
    async deleteTemplate(name: string): Promise<any> {
        const url = `${this.baseUrl}/${this.config.businessAccountId}/message_templates?name=${name}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /**
     * Upload media for template sample (Resumable Upload)
     * Returns a 'h' handle that can be used in the template components example
     */
    async uploadMediaHandle(file: Buffer | Blob, fileType: string, fileName: string): Promise<string> {
        if (!this.config.appId) {
            throw new Error('App ID is required for media uploads');
        }

        const stats = file instanceof Blob ? file.size : file.length;

        // Step 1: Initialize upload session
        const initUrl = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.appId}/uploads` +
            `?file_length=${stats}&file_type=${fileType}&access_token=${this.config.accessToken}`;

        const initRes = await fetch(initUrl, { method: 'POST' });
        if (!initRes.ok) {
            const error = await initRes.json();
            throw new Error(`Upload Init Error: ${JSON.stringify(error)}`);
        }
        const { id: uploadSessionId } = await initRes.json();

        // Step 2: Upload file content
        const uploadUrl = `https://graph.facebook.com/${this.config.apiVersion}/${uploadSessionId}`;
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${this.config.accessToken}`,
                'file_offset': '0',
                'Content-Type': fileType,
            },
            body: file as any,
        });

        if (!uploadRes.ok) {
            const error = await uploadRes.json();
            throw new Error(`Upload Error: ${JSON.stringify(error)}`);
        }

        const { h: handle } = await uploadRes.json();
        return handle;
    }

    /**
     * Get message status
     */
    async getMessageStatus(messageId: string): Promise<any> {
        const url = `${this.baseUrl}/${messageId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }

        return response.json();
    }

    /**
     * Mark message as read
     */
    async markMessageAsRead(messageId: string): Promise<void> {
        const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
        }
    }

    /**
     * Download media from WhatsApp
     */
    async downloadMedia(mediaId: string): Promise<Blob> {
        // First get media URL
        const urlResponse = await fetch(`${this.baseUrl}/${mediaId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
        });

        if (!urlResponse.ok) {
            throw new Error('Failed to get media URL');
        }

        const urlData = await urlResponse.json();
        const mediaUrl = urlData.url;

        // Download media
        const mediaResponse = await fetch(mediaUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
        });

        if (!mediaResponse.ok) {
            throw new Error('Failed to download media');
        }

        return mediaResponse.blob();
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(signature: string, payload: string, appSecret: string): boolean {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', appSecret)
            .update(payload)
            .digest('hex');

        return signature === `sha256=${expectedSignature}`;
    }

    /**
     * Test connection to WhatsApp API
     */
    async testConnection(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/${this.config.phoneNumberId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                },
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Verify if a phone number is a valid WhatsApp user
     */
    async verifyContact(phoneNumber: string): Promise<boolean> {
        // NOTE: The /contacts endpoint is for On-Premises API only.
        // Cloud API does not support it. We return true and let send/messages handle validation.
        console.warn('verifyContact is not supported in Cloud API. Proceeding with send.');
        return true;
    }
}

// Singleton instance
let whatsappServiceInstance: WhatsAppService | null = null;

export async function getWhatsAppServiceWithSettings(): Promise<WhatsAppService> {
    if (whatsappServiceInstance) return whatsappServiceInstance;

    try {
        const { db } = await import('@/lib/firebase-admin');
        if (!db) {
            throw new Error("Firebase Admin Database not initialized.");
        }
        const settingsDoc = await db.collection('whatsappSettings').doc('global').get();

        if (!settingsDoc.exists) {
            throw new Error('WhatsApp settings not found in Firestore.');
        }

        const settings = settingsDoc.data();
        if (!settings?.accessToken || !settings?.phoneNumberId) {
            throw new Error('WhatsApp API is not fully configured.');
        }

        return initializeWhatsAppService({
            accessToken: settings.accessToken,
            phoneNumberId: settings.phoneNumberId,
            businessAccountId: settings.businessAccountId || '',
            appId: settings.appId || '',
            apiVersion: settings.apiVersion || 'v18.0',
        });
    } catch (error: any) {
        console.error('Failed to initialize WhatsApp service:', error);
        throw error;
    }
}

export function getWhatsAppService(config?: WhatsAppConfig): WhatsAppService {
    if (!whatsappServiceInstance && config) {
        whatsappServiceInstance = new WhatsAppService(config);
    }

    if (!whatsappServiceInstance) {
        throw new Error('WhatsApp service not initialized. Please provide config or use getWhatsAppServiceWithSettings.');
    }

    return whatsappServiceInstance;
}

export function initializeWhatsAppService(config: WhatsAppConfig): WhatsAppService {
    whatsappServiceInstance = new WhatsAppService(config);
    return whatsappServiceInstance;
}

export { WhatsAppService };
