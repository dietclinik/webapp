
'use server';
/**
 * @fileOverview Calculates recommended macronutrient intake from calorie needs and body weight.
 *
 * - calculateMacros - A function that takes BMR/calorie needs, weight, height, and age to return estimated protein, carbs, fat, and fiber.
 */

import { z } from 'genkit';

const MacrosInputSchema = z.object({
  bmr: z.number().describe('The daily calorie needs of the person in kcal/day.'),
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
  const { bmr, weight } = MacrosInputSchema.parse({
    bmr: Number(input.bmr),
    weight: Number(input.weight),
    height: Number(input.height),
    age: Number(input.age),
  });

  if (!(bmr > 0) || !(weight > 0)) {
    return { protein: 0, carbs: 0, fat: 0, fibre: 0 };
  }

  // Protein: ~1.6g per kg of body weight (within the standard 1.2-1.8g/kg range).
  const protein = weight * 1.6;
  const proteinCalories = protein * 4;

  // Fat: ~25% of total daily calories (within the standard 20-30% range).
  const fatCalories = bmr * 0.25;
  const fat = fatCalories / 9;

  // Carbohydrates: the remainder of the daily calories.
  const carbCalories = Math.max(bmr - proteinCalories - fatCalories, 0);
  const carbs = carbCalories / 4;

  // Fiber: ~14g per 1000 calories.
  const fibre = 14 * (bmr / 1000);

  return {
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fibre: Math.round(fibre),
  };
}
