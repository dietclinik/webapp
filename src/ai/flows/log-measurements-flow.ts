
'use server';
/**
 * @fileOverview A flow to log a customer's measurements.
 *
 * - logMeasurements - Saves the measurement log and notifies relevant staff/admin.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createNotification } from './create-notification-flow';
import { calculateBodyFat } from './calculate-body-fat-flow';
import { calculateMacros } from './calculate-macros-flow';
import { sendBodyMeasurements } from '@/lib/whatsapp-helpers';

const LogMeasurementsInputSchema = z.object({
  userId: z.string().describe("The UID of the user logging their measurements."),
  weight: z.number().describe('The weight in kilograms.'),
  neck: z.number().describe('The neck measurement in inches.'),
  shoulder: z.number().describe('The shoulder measurement in inches.'),
  chest: z.number().describe('The chest measurement in inches.'),
  bicep: z.number().describe('The bicep measurement in inches.'),
  upperAbdominal: z.number().describe('The upper abdominal measurement in inches.'),
  waist: z.number().describe('The waist measurement in inches.'),
  lowerAbdominal: z.number().describe('The lower abdominal measurement in inches.'),
  hips: z.number().describe('The hips measurement in inches.'),
  thigh: z.number().describe('The thigh measurement in inches.'),
  calf: z.number().describe('The calf measurement in inches.'),
}).catchall(z.any());

export type LogMeasurementsInput = z.infer<typeof LogMeasurementsInputSchema>;

export async function logMeasurements(input: LogMeasurementsInput): Promise<{ success: boolean; id?: string }> {
  return logMeasurementsFlow(input);
}

const logMeasurementsFlow = ai.defineFlow(
  {
    name: 'logMeasurementsFlow',
    inputSchema: LogMeasurementsInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  },
  async (input) => {
    const { userId, ...measurements } = input;

    if (!db) {
      console.error("Firestore not available. Skipping measurement log.");
      return { success: false };
    }

    try {
      const measurementLogData = {
        userId,
        ...measurements,
        date: Timestamp.now(),
      };

      const docRef = await db.collection('measurementLogs').add(measurementLogData);
      const logId = docRef.id;
      console.log(`Measurement log created for ${userId} with ID: ${logId}`);

      // 1. Fetch data for notifications and calculations
      const [customerDoc, profileDoc] = await Promise.all([
        db.collection('customers').doc(userId).get(),
        db.collection('userProfiles').doc(userId).get()
      ]);

      const customerData = customerDoc.data();
      const profileData = profileDoc.data();
      const customerName = customerData?.name || 'A customer';

      // 2. Handle In-App Notifications
      if (customerDoc.exists) {
        let customFieldsMessage = '';
        for (const key in measurements) {
          if (Object.prototype.hasOwnProperty.call(measurements, key)) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            customFieldsMessage += `, ${formattedKey}: ${measurements[key]}`;
          }
        }

        const notificationMessage = `${customerName} logged new measurements${customFieldsMessage}.`;
        const notificationPromises = [];

        notificationPromises.push(createNotification({
          userId: 'admin',
          message: notificationMessage,
          link: `/admin/customers/view/${userId}`
        }));

        if (customerData?.assignedStaffId) {
          notificationPromises.push(createNotification({
            userId: customerData.assignedStaffId,
            message: notificationMessage,
            link: `/staff/my-customers/view/${userId}`
          }));
        }
        await Promise.all(notificationPromises);
      }

      // 3. Handle WhatsApp Health Report
      if (customerData?.mobile && profileData) {
        const height = Number(profileData.height);
        const age = Number(profileData.age);
        const gender = profileData.gender;

        if (height && age && gender) {
          const heightInMeters = height / 100;
          const bmi = (measurements.weight / (heightInMeters * heightInMeters)).toFixed(1);

          let bmrValue = 0;
          if (gender === 'male') {
            bmrValue = (10 * measurements.weight) + (6.25 * height) - (5 * age) + 5;
          } else {
            bmrValue = (10 * measurements.weight) + (6.25 * height) - (5 * age) - 161;
          }

          // Convert inch measurements to cm for body fat calculation
          const neckCm = measurements.neck * 2.54;
          const waistCm = measurements.waist * 2.54;
          const hipsCm = measurements.hips ? measurements.hips * 2.54 : 0;

          const bodyFatResult = await calculateBodyFat({
            gender: gender as 'male' | 'female',
            height,
            neck: neckCm,
            waist: waistCm,
            ...(gender === 'female' && { hips: hipsCm })
          });

          const macros = await calculateMacros({
            bmr: bmrValue,
            weight: measurements.weight,
            height,
            age
          });

          await sendBodyMeasurements({
            phone: customerData.mobile,
            name: customerName,
            userId,
            bmi,
            bmr: bmrValue.toFixed(0),
            bodyFat: bodyFatResult.bodyFatPercentage.toFixed(1),
            protein: macros.protein.toFixed(1),
            carbs: macros.carbs.toFixed(1),
            fats: macros.fat.toFixed(1)
          });
        }
      }

      return { success: true, id: logId };

    } catch (error) {
      console.error(`Failed to create measurement log for ${userId}:`, error);
      return { success: false };
    }
  }
);
