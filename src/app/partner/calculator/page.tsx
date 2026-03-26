
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User } from "firebase/auth";
import { calculateBodyFat } from "@/ai/flows/calculate-body-fat-flow";
import { calculateMacros, type MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { partnerCalculator } from "@/ai/flows/partner-calculator-flow";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calculator as CalculatorIcon, BrainCircuit, Flame, Drumstick, Leaf, Wheat, Ruler } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  customerName: z.string().min(2, "Name is required."),
  customerEmail: z.string().email("A valid email is required."),
  customerMobile: z.string().regex(/^\d{10}$/, "A valid 10-digit mobile number is required."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.enum(['male', 'female'], { required_error: "Gender is required." }),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  neck: z.coerce.number().min(1, "Neck measurement is required."),
  waist: z.coerce.number().min(1, "Waist measurement is required."),
  hips: z.coerce.number().optional(),
  activityLevel: z.string().min(1, "Please select an activity level."),
}).refine(data => data.gender !== 'female' || (data.gender === 'female' && data.hips && data.hips > 0), {
    message: "Hips measurement is required for females.",
    path: ["hips"],
});

type CalculatorFormData = z.infer<typeof formSchema>;

type BmiResult = {
  value: string;
  message: string;
  colorClass: string;
  suggestion?: string;
  suggestionColorClass?: string;
};

type BodyFatResult = {
    value: string;
    message: string;
    colorClass: string;
};

type BmrResult = {
    value: string;
    message: string;
}

const activityLevels = [
  { id: "sedentary", label: "Little or No Exercise", multiplier: 1.2 },
  { id: "light", label: "Light Exercise/Sports (1-3 Days/week)", multiplier: 1.375 },
  { id: "moderate", label: "Moderate Exercise/Sports (3-5 Days/week)", multiplier: 1.55 },
  { id: "hard", label: "Hard Exercise/Sports (6-7 Days/week)", multiplier: 1.725 },
  { id: "very-hard", label: "Very Hard Exercise/Sports & Physical Job", multiplier: 1.9 },
];

export default function PartnerCalculatorPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partner, setPartner] = useState<User | null>(null);
  const [bmiResult, setBmiResult] = useState<BmiResult | null>(null);
  const [bmrResult, setBmrResult] = useState<BmrResult | null>(null);
  const [macroResult, setMacroResult] = useState<MacrosOutput | null>(null);
  const [bodyFatResult, setBodyFatResult] = useState<BodyFatResult | null>(null);
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);
  const [isCalculatingBodyFat, setIsCalculatingBodyFat] = useState(false);

  const { toast } = useToast();
  const { auth } = useFirebase();

  const form = useForm<CalculatorFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        customerName: "", customerEmail: "", customerMobile: "",
        age: "" as any, gender: undefined, height: "" as any, weight: "" as any,
        neck: "" as any, waist: "" as any, hips: "" as any, activityLevel: ""
    }
  });

  const watchedGender = form.watch("gender");
  const watchedHeight = form.watch("height");
  const watchedWeight = form.watch("weight");
  const watchedAge = form.watch("age");
  const watchedNeck = form.watch("neck");
  const watchedWaist = form.watch("waist");
  const watchedHips = form.watch("hips");
  const watchedActivityLevel = form.watch("activityLevel");

  useEffect(() => {
    const calculateBmiAndBmr = () => {
        const heightInMeters = Number(watchedHeight) / 100;
        const weightInKg = Number(watchedWeight);
        const ageInYears = Number(watchedAge);
        const gender = watchedGender;

        if (heightInMeters > 0 && weightInKg > 0) {
            const bmi = weightInKg / (heightInMeters * heightInMeters);
            let message = "", colorClass = "", suggestion = "", suggestionColorClass = "";
            const targetWeight = 22 * (heightInMeters * heightInMeters);
            const weightDiff = weightInKg - targetWeight;

            if (bmi < 18.5) { message = "Underweight"; colorClass = "bg-blue-100"; suggestion = `User should Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`; suggestionColorClass="bg-blue-200"; }
            else if (bmi < 25) { message = "Normal"; colorClass = "bg-green-100"; suggestion = "User is in a healthy weight range."; suggestionColorClass="bg-green-200"; }
            else if (bmi < 30) { message = "Overweight"; colorClass = "bg-orange-100"; suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`; suggestionColorClass="bg-orange-200"; }
            else { message = "Obesity"; colorClass = "bg-red-100"; suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`; suggestionColorClass="bg-red-200"; }
            setBmiResult({ value: bmi.toFixed(2), message, colorClass, suggestion, suggestionColorClass });
        } else { setBmiResult(null); }
        
        let bmr = 0;
        if (weightInKg > 0 && heightInMeters > 0 && ageInYears > 0 && gender) {
            if(gender === 'male'){ bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5; }
            else { bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161; }
            setBmrResult({ value: bmr.toFixed(0), message: "calories/day" });
        } else { setBmrResult(null); }
    };
    calculateBmiAndBmr();
  }, [watchedHeight, watchedWeight, watchedAge, watchedGender]);

    useEffect(() => {
        const calculateNewMacros = async () => {
            const calorieNeeds = Number(watchedActivityLevel);
            if (bmrResult && calorieNeeds > 0 && watchedWeight > 0 && watchedHeight > 0 && watchedAge > 0) {
                setIsCalculatingMacros(true);
                try {
                    const result = await calculateMacros({ bmr: calorieNeeds, weight: watchedWeight, height: watchedHeight, age: watchedAge });
                    setMacroResult(result);
                } catch (e) { console.error("Macro calculation failed:", e); setMacroResult(null); }
                finally { setIsCalculatingMacros(false); }
            } else {
                setMacroResult(null);
            }
        };
        calculateNewMacros();
    }, [watchedActivityLevel, bmrResult, watchedWeight, watchedHeight, watchedAge]);

    useEffect(() => {
        const calculateNewBodyFat = async () => {
            const heightCm = Number(watchedHeight);
            const neckCm = Number(watchedNeck);
            const waistCm = Number(watchedWaist);
            const hipsCm = Number(watchedHips);
            const genderValue = watchedGender as "male" | "female";

            if (heightCm > 0 && neckCm > 0 && waistCm > 0 && (genderValue === 'male' || (genderValue === 'female' && hipsCm > 0))) {
                setIsCalculatingBodyFat(true);
                try {
                    const result = await calculateBodyFat({ 
                        gender: genderValue, 
                        height: heightCm, 
                        neck: neckCm, 
                        waist: waistCm, 
                        hips: genderValue === 'female' ? hipsCm : undefined
                    });
                    const bfp = result.bodyFatPercentage;
                    let message = "", colorClass = "";
                    if (genderValue === 'male') {
                        if (bfp < 6) { message = "Essential Fat"; colorClass = "bg-blue-100"; } else if (bfp < 14) { message = "Athletes"; colorClass = "bg-green-100"; } else if (bfp < 18) { message = "Fitness"; colorClass = "bg-green-100"; } else if (bfp < 25) { message = "Average"; colorClass = "bg-orange-100"; } else { message = "Obese"; colorClass = "bg-red-100"; }
                    } else {
                        if (bfp < 14) { message = "Essential Fat"; colorClass = "bg-blue-100"; } else if (bfp < 21) { message = "Athletes"; colorClass = "bg-green-100"; } else if (bfp < 25) { message = "Fitness"; colorClass = "bg-green-100"; } else if (bfp < 32) { message = "Average"; colorClass = "bg-orange-100"; } else { message = "Obese"; colorClass = "bg-red-100"; }
                    }
                    setBodyFatResult({ value: bfp.toFixed(1), message, colorClass });

                } catch (e) { console.error("Body fat calculation failed:", e); setBodyFatResult(null); }
                finally { setIsCalculatingBodyFat(false); }
            }
        };
        calculateNewBodyFat();
    }, [watchedHeight, watchedNeck, watchedWaist, watchedHips, watchedGender]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => setPartner(user));
    return () => unsubscribe();
  }, [auth]);

  const onSubmit = async (data: CalculatorFormData) => {
    if (!partner) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const result = await partnerCalculator({
            ...data,
            partnerId: partner.uid,
        });

        if(result.success) {
            toast({ variant: 'success', title: 'Success!', description: result.message });
            form.reset();
            setBodyFatResult(null);
            setMacroResult(null);
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Calculation Failed', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalculatorIcon /> Health Calculator</CardTitle>
        <CardDescription>Enter your customer's details to calculate their health metrics and send them a report.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="space-y-4">
                        <FormField control={form.control} name="customerName" render={({ field }) => (<FormItem><FormLabel>Customer Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="customerEmail" render={({ field }) => (<FormItem><FormLabel>Customer Email *</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="customerMobile" render={({ field }) => (<FormItem><FormLabel>Customer Mobile *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age *</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm) *</FormLabel><FormControl><Input type="number" placeholder="175" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (kg) *</FormLabel><FormControl><Input type="number" placeholder="70" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="neck" render={({ field }) => (<FormItem><FormLabel>Neck (cm) *</FormLabel><FormControl><Input type="number" placeholder="38" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm) *</FormLabel><FormControl><Input type="number" placeholder="90" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        {watchedGender === 'female' && (<FormField control={form.control} name="hips" render={({ field }) => (<FormItem><FormLabel>Hips (cm) *</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>)}/>)}
                    </div>
                    {bmrResult && (
                        <FormField
                            control={form.control}
                            name="activityLevel"
                            render={({ field }) => (
                                <FormItem className="space-y-3 pt-4"><FormLabel>Daily Activity Level *</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                    {activityLevels.map(level => {
                                        const calorieNeeds = (parseFloat(bmrResult.value) * level.multiplier).toFixed(0);
                                        return (
                                            <FormItem key={level.id} className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value={String(calorieNeeds)} id={level.id} />
                                                </FormControl>
                                                <Label htmlFor={level.id} className="font-normal">
                                                   {level.label}: <span className="font-semibold text-primary">{calorieNeeds} kcal</span>
                                                </Label>
                                            </FormItem>
                                        )
                                    })}
                                    </RadioGroup>
                                </FormControl><FormMessage /></FormItem>
                            )}
                        />
                    )}
                </div>
                <div className="space-y-4">
                    {bmiResult && (
                        <Card className={cn("transition-all", bmiResult.colorClass)}>
                            <CardHeader><CardTitle>BMI Result</CardTitle><CardDescription>Body Mass Index</CardDescription></CardHeader>
                            <CardContent className="text-center">
                                <p className="text-5xl font-bold">{bmiResult.value}</p>
                                <p className="text-lg font-semibold mt-2">{bmiResult.message}</p>
                                {bmiResult.suggestion && <p className={cn("text-base font-bold mt-2 p-2 rounded-md", bmiResult.suggestionColorClass)}>{bmiResult.suggestion}</p>}
                            </CardContent>
                        </Card>
                    )}
                    {bodyFatResult && (
                        <Card className={cn("transition-all", bodyFatResult.colorClass)}>
                            <CardHeader><CardTitle>Body Fat Estimate</CardTitle></CardHeader>
                            <CardContent className="text-center">{isCalculatingBodyFat ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : <> <p className="text-5xl font-bold">{bodyFatResult.value}%</p><p className="text-lg font-semibold mt-2">{bodyFatResult.message}</p></>}</CardContent>
                        </Card>
                    )}
                    <Card className="bg-amber-50 dark:bg-amber-900/20 relative">
                        <CardHeader><CardTitle>Daily Macronutrient Needs</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {macroResult ? (<><p className="flex items-center gap-2"><Drumstick className="h-5 w-5 text-amber-600"/> Protein: <span className="font-bold ml-auto">{macroResult.protein.toFixed(0)}g</span></p><p className="flex items-center gap-2"><Wheat className="h-5 w-5 text-amber-600"/> Carbohydrates: <span className="font-bold ml-auto">{macroResult.carbs.toFixed(0)}g</span></p><p className="flex items-center gap-2"><Flame className="h-5 w-5 text-amber-600"/> Fat: <span className="font-bold ml-auto">{macroResult.fat.toFixed(0)}g</span></p><p className="flex items-center gap-2"><Leaf className="h-5 w-5 text-amber-600"/> Fibre: <span className="font-bold ml-auto">{macroResult.fibre.toFixed(0)}g</span></p></>) : (<p className="text-sm text-muted-foreground">Select an activity level to estimate needs.</p>)}
                        </CardContent>
                        {isCalculatingMacros && (<div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>)}
                    </Card>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Calculating & Sending..." : "Calculate & Send Email"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
