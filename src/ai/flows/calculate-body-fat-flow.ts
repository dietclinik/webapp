
'use server';
/**
 * @fileOverview An AI flow to estimate body fat percentage using the U.S. Navy method.
 *
 * - calculateBodyFat - Takes gender, height, neck, and waist measurements to return an estimated body fat percentage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BodyFatInputSchema = z.object({
  gender: z.enum(['male', 'female']).describe('The gender of the person.'),
  height: z.number().describe("The person's height in centimeters."),
  neck: z.number().describe("The person's neck circumference in centimeters."),
  waist: z.number().describe("The person's waist circumference at the navel in centimeters."),
  hips: z.number().optional().describe("The person's hip circumference in centimeters (required for females)."),
});

const BodyFatOutputSchema = z.object({
  bodyFatPercentage: z.number().describe('The estimated body fat percentage.'),
});
export type BodyFatOutput = z.infer<typeof BodyFatOutputSchema>;

export async function calculateBodyFat(input: z.infer<typeof BodyFatInputSchema>): Promise<BodyFatOutput> {
  return calculateBodyFatFlow(input);
}

const calculateBodyFatFlow = ai.defineFlow(
  {
    name: 'calculateBodyFatFlow',
    inputSchema: BodyFatInputSchema,
    outputSchema: BodyFatOutputSchema,
  },
  async (input) => {
    let bodyFatPercentage = 0;
    
    const heightIn = input.height * 0.393701;
    const neckIn = input.neck * 0.393701;
    const waistIn = input.waist * 0.393701;

    if (input.gender === 'male') {
      bodyFatPercentage =
        86.010 * Math.log10(waistIn - neckIn) -
        70.041 * Math.log10(heightIn) +
        36.76;
    } else { // female
      if (!input.hips) {
        return { bodyFatPercentage: 0 };
      }
      const hipsIn = input.hips * 0.393701;
      bodyFatPercentage =
        163.205 * Math.log10(waistIn + hipsIn - neckIn) -
        97.684 * Math.log10(heightIn) -
        78.387;
    }

    // Ensure the result is within a reasonable range and not NaN
    if (isNaN(bodyFatPercentage) || bodyFatPercentage <= 0 || bodyFatPercentage > 70) {
      return { bodyFatPercentage: 0 };
    }

    return { bodyFatPercentage: parseFloat(bodyFatPercentage.toFixed(2)) };
  }
);
