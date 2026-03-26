
'use server';
/**
 * @fileOverview An AI flow to calculate recommended macronutrient intake.
 *
 * - calculateMacros - A function that takes BMR, weight, height, and age to return estimated protein, carbs, fat, and fiber.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MacrosInputSchema = z.object({
  bmr: z.number().describe('The Basal Metabolic Rate of the person in kcal/day.'),
  weight: z.number().describe('The weight of the person in kilograms.'),
  height: z.number().describe('The height of the person in centimeters.'),
  age: z.number().describe('The age of the person in years.'),
});

const MacrosOutputSchema = z.object({
  protein: z.number().describe('The recommended daily protein intake in grams.'),
  carbs: z.number().describe('The recommended daily carbohydrate intake in grams.'),
  fat: z.number().describe('The recommended daily fat intake in grams.'),
  fibre: z.number().describe('The recommended daily fiber intake in grams.'),
});
export type MacrosOutput = z.infer<typeof MacrosOutputSchema>;

export async function calculateMacros(input: z.infer<typeof MacrosInputSchema>): Promise<MacrosOutput> {
  return calculateMacrosFlow(input);
}

const macroPrompt = ai.definePrompt({
  name: 'macroPrompt',
  input: { schema: MacrosInputSchema },
  output: { schema: MacrosOutputSchema },
  prompt: `You are a nutrition expert. Based on the user's BMR, weight, height, and age, calculate a balanced daily intake for protein, carbohydrates, fat, and fiber.

  - Protein should be around 1.2-1.8 grams per kg of body weight.
  - Fat should be around 20-30% of total daily calories (use BMR as a baseline for calories).
  - Carbohydrates should make up the rest of the calories.
  - Fiber should be around 14 grams per 1000 calories.

  Remember: 1g protein = 4 calories, 1g carbs = 4 calories, 1g fat = 9 calories.

  User data:
  - BMR: {{{bmr}}} kcal
  - Weight: {{{weight}}} kg
  - Height: {{{height}}} cm
  - Age: {{{age}}} years
  
  Provide a numerical estimate in grams for each field.`,
});

const calculateMacrosFlow = ai.defineFlow(
  {
    name: 'calculateMacrosFlow',
    inputSchema: z.any(), // Accept any input to handle coercion manually
    outputSchema: MacrosOutputSchema,
  },
  async (input) => {
    try {
        // Coerce input types to ensure they are numbers
        const numericInput = {
            bmr: Number(input.bmr),
            weight: Number(input.weight),
            height: Number(input.height),
            age: Number(input.age),
        };

        const { output } = await macroPrompt(numericInput);
        if (output) {
            return output;
        } else {
             return { protein: 0, carbs: 0, fat: 0, fibre: 0 };
        }
    } catch(e) {
        console.error("Error in calculateMacrosFlow:", e);
        return { protein: 0, carbs: 0, fat: 0, fibre: 0 };
    }
  }
);
