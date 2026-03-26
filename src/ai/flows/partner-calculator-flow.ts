
'use server';
/**
 * @fileOverview A flow for partners to calculate health metrics for their customers and send them an email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { calculateBodyFat } from './calculate-body-fat-flow';
import { calculateMacros, type MacrosOutput } from './calculate-macros-flow';
import nodemailer from 'nodemailer';

const CalculatorInputSchema = z.object({
  partnerId: z.string(),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerMobile: z.string().regex(/^\d{10}$/),
  age: z.coerce.number().min(1),
  gender: z.enum(['male', 'female']),
  height: z.coerce.number().min(1),
  weight: z.coerce.number().min(1),
  neck: z.coerce.number().min(1),
  waist: z.coerce.number().min(1),
  hips: z.coerce.number().optional(),
  activityLevel: z.string().min(1),
});

type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

export async function partnerCalculator(input: CalculatorInput): Promise<{ success: boolean; message: string; }> {
  return partnerCalculatorFlow(input);
}

const createHealthReportEmailTemplate = (data: any) => `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
  .container { max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; }
  .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
  .metric { background: #f9f9f9; border-left: 4px solid #3498db; margin: 15px 0; padding: 15px; }
  .metric h3 { margin-top: 0; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Your Health Snapshot</h2>
      <p>Prepared by ${data.partnerName}</p>
    </div>
    <p>Hi ${data.customerName},</p>
    <p>Here is a summary of the health metrics based on the information you provided:</p>
    <div class="metric">
      <h3>Body Mass Index (BMI)</h3>
      <p><strong>${data.bmiValue}</strong> (${data.bmiMessage})</p>
      <p><em>${data.bmiSuggestion}</em></p>
    </div>
    <div class="metric">
      <h3>Body Fat Percentage</h3>
      <p><strong>${data.bodyFatValue}%</strong> (${data.bodyFatMessage})</p>
    </div>
    <div class="metric">
      <h3>Estimated Daily Calorie Needs</h3>
      <p><strong>${data.calories} kcal/day</strong></p>
    </div>
    <div class="metric">
      <h3>Recommended Daily Macronutrients</h3>
      <p><strong>Protein:</strong> ${data.protein}g</p>
      <p><strong>Carbohydrates:</strong> ${data.carbs}g</p>
      <p><strong>Fat:</strong> ${data.fat}g</p>
      <p><strong>Fibre:</strong> ${data.fibre}g</p>
    </div>
    <p>This is a great starting point for your health journey! If you're ready to take the next step, let's discuss a personalized plan for you.</p>
    <p>Best regards,<br>${data.partnerName}</p>
  </div>
</body>
</html>
`;


const partnerCalculatorFlow = ai.defineFlow(
  {
    name: 'partnerCalculatorFlow',
    inputSchema: CalculatorInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    if (!db) {
      return { success: false, message: "Database not configured." };
    }

    // 1. Fetch Partner Name
    const partnerDoc = await db.collection('vendors').doc(input.partnerId).get();
    if (!partnerDoc.exists) {
        return { success: false, message: "Partner account not found." };
    }
    const partnerName = partnerDoc.data()!.name || "Your Health Consultant";
    
    // 2. Perform Calculations
    // BMI
    const heightInMeters = input.height / 100;
    const bmi = input.weight / (heightInMeters * heightInMeters);
    let bmiMessage = "", bmiSuggestion = "";
    const targetWeight = 22 * (heightInMeters * heightInMeters);
    const weightDiff = input.weight - targetWeight;
    if (bmi < 18.5) { bmiMessage = "Underweight"; bmiSuggestion = `You should Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`; }
    else if (bmi < 25) { bmiMessage = "Normal Weight"; bmiSuggestion = "You are in a healthy weight range."; }
    else if (bmi < 30) { bmiMessage = "Overweight"; bmiSuggestion = `You should Lose ${weightDiff.toFixed(1)} kg to be Fit`; }
    else { bmiMessage = "Obesity"; bmiSuggestion = `You should Lose ${weightDiff.toFixed(1)} kg to be Fit`; }

    // Body Fat
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
      if (input.hips) {
        const hipsIn = input.hips * 0.393701;
        bodyFatPercentage =
          163.205 * Math.log10(waistIn + hipsIn - neckIn) -
          97.684 * Math.log10(heightIn) -
          78.387;
      }
    }
    bodyFatPercentage = (isNaN(bodyFatPercentage) || bodyFatPercentage < 0) ? 0 : bodyFatPercentage;

    let bfpMessage = "";
    if (input.gender === 'male') {
        if (bodyFatPercentage < 6) bfpMessage = "Essential Fat"; else if (bodyFatPercentage < 14) bfpMessage = "Athletes"; else if (bodyFatPercentage < 18) bfpMessage = "Fitness"; else if (bodyFatPercentage < 25) bfpMessage = "Average"; else bfpMessage = "Obese";
    } else {
        if (bodyFatPercentage < 14) bfpMessage = "Essential Fat"; else if (bodyFatPercentage < 21) bfpMessage = "Athletes"; else if (bodyFatPercentage < 25) bfpMessage = "Fitness"; else if (bodyFatPercentage < 32) bfpMessage = "Average"; else bfpMessage = "Obese";
    }

    // Macros
    const calorieNeeds = parseFloat(input.activityLevel);
    let macros: MacrosOutput = { protein: 0, carbs: 0, fat: 0, fibre: 0 };
    if (calorieNeeds > 0) {
        macros = await calculateMacros({ 
            bmr: calorieNeeds, 
            weight: Number(input.weight), 
            height: Number(input.height), 
            age: Number(input.age) 
        });
    }

    // 3. Save to partnerEnquiries
    const enquiryData = {
        ...input,
        calculatedBmi: bmi.toFixed(2),
        calculatedCalories: calorieNeeds,
        createdAt: Timestamp.now()
    };
    await db.collection('partnerEnquiries').add(enquiryData);

    // 4. Send Email
    if (!process.env.SMTP_HOST) {
        console.warn("SMTP not configured, skipping email.");
        return { success: true, message: "Calculations complete and enquiry saved. Email not sent (SMTP not configured)." };
    }
    
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const emailData = {
        partnerName,
        customerName: input.customerName,
        bmiValue: bmi.toFixed(2),
        bmiMessage,
        bmiSuggestion,
        bodyFatValue: bodyFatPercentage.toFixed(1),
        bodyFatMessage: bfpMessage,
        calories: calorieNeeds.toFixed(0),
        protein: macros.protein.toFixed(0),
        carbs: macros.carbs.toFixed(0),
        fat: macros.fat.toFixed(0),
        fibre: macros.fibre.toFixed(0),
    };

    const mailOptions = {
        from: `"${partnerName} via Diet Clinik" <${process.env.SMTP_FROM_EMAIL}>`,
        to: input.customerEmail,
        subject: `Your Health Report from ${partnerName}`,
        html: createHealthReportEmailTemplate(emailData),
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: "Calculation successful and email sent to the customer." };
    } catch (error: any) {
        console.error("Failed to send email:", error);
        return { success: true, message: `Enquiry saved, but failed to send email: ${error.message}` };
    }
  }
);
