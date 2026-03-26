
'use server';
/**
 * @fileOverview A flow to send WhatsApp messages via Meta Cloud API.
 * 
 * This flow has been updated to use the direct Meta Cloud API integration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getWhatsAppService, getWhatsAppServiceWithSettings } from '@/lib/whatsapp-service';

const WhatsAppInputSchema = z.object({
  templateName: z.string().describe('The approved template name from your Meta WhatsApp Business dashboard.'),
  recipient: z.string().describe('The mobile number of the recipient.'),
  variables: z.array(z.string()).optional().describe('An ordered array of strings for the template variables.'),
});
export type WhatsAppInput = z.infer<typeof WhatsAppInputSchema>;

export async function sendWhatsAppMessage(input: WhatsAppInput): Promise<{ success: boolean; message: string }> {
  return sendWhatsAppMessageFlow(input);
}

const sendWhatsAppMessageFlow = ai.defineFlow(
  {
    name: 'sendWhatsAppMessageFlow',
    inputSchema: WhatsAppInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ templateName, recipient, variables }) => {
    try {
      const whatsappService = await getWhatsAppServiceWithSettings();

      // Map variables to the format expected by WhatsApp Cloud API
      const bodyVariables = variables?.map(v => ({
        type: "text" as const,
        text: v
      })) || [];

      const result = await whatsappService.sendTemplateMessage({
        to: recipient,
        templateName,
        language: 'en',
        components: bodyVariables.length > 0 ? [{
          type: 'body',
          parameters: bodyVariables
        }] : undefined
      });

      if (result.messages && result.messages.length > 0) {
        return { success: true, message: "Message sent successfully via Meta API." };
      } else {
        return { success: false, message: "Meta API did not return a message ID." };
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp message via Meta API:', error);
      return { success: false, message: `Failed to send message: ${error.message}` };
    }
  }
);
