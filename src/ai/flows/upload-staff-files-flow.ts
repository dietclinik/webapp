
'use server';
/**
 * @fileOverview A flow to handle uploading staff files and then creating the staff member.
 *
 * - uploadStaffFilesAndCreateStaff - Uploads photo/resume from data URIs and then calls the staff creation flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { admin } from '@/lib/firebase-admin';
import { sendStaffWelcomeEmail, StaffWelcomeInput } from './send-staff-welcome-email-flow';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

const UploadStaffFilesInputSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    mobile: z.string(),
    address: z.string(),
    experience: z.number(),
    photoDataUri: z.string().optional().describe("A photo of the staff member, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
    resumeDataUri: z.string().optional().describe("The staff member's resume, as a data URI that must include a MIME type and use Base64 encoding."),
});
export type UploadStaffFilesInput = z.infer<typeof UploadStaffFilesInputSchema>;


export async function uploadStaffFilesAndCreateStaff(input: UploadStaffFilesInput): Promise<{ userId?: string; message: string }> {
  return uploadStaffFilesFlow(input);
}


const uploadStaffFilesFlow = ai.defineFlow(
  {
    name: 'uploadStaffFilesFlow',
    inputSchema: UploadStaffFilesInputSchema,
    outputSchema: z.object({ userId: z.string().optional(), message: z.string() }),
  },
  async (input) => {
    if (!admin.apps.length) {
        throw new Error("Firebase Admin SDK not initialized.");
    }
    
    const { photoDataUri, resumeDataUri, ...staffData } = input;
    let photoURL: string | undefined = undefined;
    let resumeURL: string | undefined = undefined;

    const storage = getStorage();
    const bucket = storage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

    try {
        if (photoDataUri) {
            const match = photoDataUri.match(/^data:(.+);base64,(.+)$/);
            if (!match) throw new Error("Invalid photo data URI format.");
            
            const [_, mimeType, base64Data] = match;
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `staff_photos/${Date.now()}_${uuidv4()}`;
            const file = bucket.file(fileName);

            await file.save(buffer, {
                metadata: { contentType: mimeType },
                public: true, // Make file publicly readable
            });
            photoURL = file.publicUrl();
        }

        if (resumeDataUri) {
            const match = resumeDataUri.match(/^data:(.+);base64,(.+)$/);
            if (!match) throw new Error("Invalid resume data URI format.");

            const [_, mimeType, base64Data] = match;
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `staff_resumes/${Date.now()}_${uuidv4()}`;
            const file = bucket.file(fileName);

            await file.save(buffer, {
                metadata: { contentType: mimeType },
                public: true,
            });
            resumeURL = file.publicUrl();
        }

        // Now that files are uploaded, call the original flow to create the user
        const result = await sendStaffWelcomeEmail({
            ...staffData,
            photoURL,
            resumeURL,
        });

        return result;

    } catch (error: any) {
        console.error("Error in uploadStaffFilesFlow:", error);
        throw new Error(`Failed to upload files or create staff: ${error.message}`);
    }
  }
);
