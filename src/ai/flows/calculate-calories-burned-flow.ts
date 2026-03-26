
'use server';
/**
 * @fileOverview An AI flow to estimate calories burned during an activity.
 *
 * - calculateCaloriesBurned - Takes activity, duration, intensity, and weight to return estimated calories.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CaloriesBurnedInputSchema = z.object({
  activityName: z.string().describe("The name of the physical activity performed (e.g., 'Running', 'Swimming')."),
  durationValue: z.string().describe("The duration of the activity (e.g., '30 minutes', '1 hour')."),
  intensityName: z.string().describe("The intensity level of the activity (e.g., 'Low', 'Medium', 'High')."),
  userWeight: z.number().describe("The user's current weight in kilograms."),
});

const CaloriesBurnedOutputSchema = z.object({
  caloriesBurned: z.number().describe('The estimated number of calories burned.'),
});
export type CaloriesBurnedOutput = z.infer<typeof CaloriesBurnedOutputSchema>;

export async function calculateCaloriesBurned(input: z.infer<typeof CaloriesBurnedInputSchema>): Promise<CaloriesBurnedOutput> {
  return calculateCaloriesBurnedFlow(input);
}

const caloriesPrompt = ai.definePrompt({
  name: 'caloriesBurnedPrompt',
  input: { schema: CaloriesBurnedInputSchema },
  output: { schema: CaloriesBurnedOutputSchema },
  prompt: `You are a fitness expert. Your task is to estimate the calories burned for a physical activity based on the MET (Metabolic Equivalent of Task) value.

  The formula is: Calories Burned = MET value * user weight (kg) * duration (hours).

  1.  **Estimate MET Value:** Based on the activity name and intensity, estimate a reasonable MET value.
      - Low intensity is typically 2-3.5 METs.
      - Medium intensity is 3.5-7 METs.
      - High intensity is >7 METs.
      For example, 'Running' at 'Medium' intensity could be around 8 METs. 'Walking' at 'Low' intensity could be 3 METs.

  2.  **Convert Duration:** Convert the duration string into hours. For example, '30 minutes' is 0.5 hours.

  3.  **Calculate:** Apply the formula to get the total calories burned.

  4.  **Return Only the Number:** Provide only the final calculated number for the caloriesBurned field.

  User Data:
  - Activity: {{{activityName}}}
  - Duration: {{{durationValue}}}
  - Intensity: {{{intensityName}}}
  - User Weight: {{{userWeight}}} kg

  Return a numerical estimate for the caloriesBurned.`,
});

const calculateCaloriesBurnedFlow = ai.defineFlow(
  {
    name: 'calculateCaloriesBurnedFlow',
    inputSchema: CaloriesBurnedInputSchema,
    outputSchema: CaloriesBurnedOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await caloriesPrompt(input);
        if (output) {
            return output;
        } else {
             return { caloriesBurned: 0 };
        }
    } catch(e) {
        console.error("Error in calculateCaloriesBurnedFlow:", e);
        return { caloriesBurned: 0 };
    }
  }
);
