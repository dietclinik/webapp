
'use server';
/**
 * @fileOverview An AI flow to calculate nutritional information for a given food item.
 *
 * - calculateNutrition - A function that takes a food name and quantity and returns estimated calories, protein, fat, carbs, and fiber.
 * - NutritionInput - The input type for the calculateNutrition function.
 * - NutritionOutput - The return type for the calculateNutrition function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NutritionInputSchema = z.object({
  foodQuery: z.string().describe('The name and quantity of the food item (e.g., "1 bowl of oats" or "2 scrambled eggs").'),
});
export type NutritionInput = z.infer<typeof NutritionInputSchema>;

const NutritionOutputSchema = z.object({
  calories: z.number().describe('The estimated number of calories in the food item.'),
  protein: z.number().describe('The estimated grams of protein in the food item.'),
  fat: z.number().describe('The estimated grams of fat in the food item.'),
  carbs: z.number().describe('The estimated grams of carbohydrates in the food item.'),
  fibre: z.number().describe('The estimated grams of fiber in the food item.'),
});
export type NutritionOutput = z.infer<typeof NutritionOutputSchema>;

export async function calculateNutrition(input: NutritionInput): Promise<NutritionOutput> {
  return calculateNutritionFlow(input);
}

const nutritionPrompt = ai.definePrompt({
  name: 'nutritionPrompt',
  input: { schema: NutritionInputSchema },
  output: { schema: NutritionOutputSchema },
  prompt: `You are a nutrition expert. Based on the user's query, calculate the estimated calories, protein, fat, carbohydrates, and fiber for the food item.
  
  Please provide a numerical estimate for each field. If you cannot determine a value, return 0.
  
  Food: {{{foodQuery}}}`,
});

const calculateNutritionFlow = ai.defineFlow(
  {
    name: 'calculateNutritionFlow',
    inputSchema: NutritionInputSchema,
    outputSchema: NutritionOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await nutritionPrompt(input);
        if (output) {
            return output;
        } else {
             return { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
        }
    } catch(e) {
        console.error("Error in calculateNutritionFlow:", e);
        // Return zero values on error to prevent breaking the frontend
        return { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
    }
  }
);
