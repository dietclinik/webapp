

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  User,
  HeartPulse,
  BookCopy,
  Loader2,
  Flame,
  Wheat,
  Drumstick,
  Leaf,
} from "lucide-react";
import { format, addMonths, addDays } from "date-fns";
import { collection, getDocs, doc, getDoc, where, query } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { sendVendorCustomerWelcomeEmail } from "@/ai/flows/send-vendor-customer-welcome-email-flow";
import { calculateMacros, type MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

type Plan = {
  id: string;
  name: string;
  durationMonths: number;
  durationDays: number;
};

type BmiResult = {
  value: string;
  message: string;
  colorClass: string;
  suggestion?: string;
};

type BmrResult = {
    value: string;
    message: string;
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  activityLevel: z.string().min(1, "Please select an activity level."),
  planId: z.string().min(1, "Please select a subscription plan."),
});


export default function VendorAddCustomerPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendor, setVendor] = useState<FirebaseUser | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [bmiResult, setBmiResult] = useState<BmiResult | null>(null);
  const [bmrResult, setBmrResult] = useState<BmrResult | null>(null);
  const [macroResult, setMacroResult] = useState<MacrosOutput | null>(null);
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      age: "" as any,
      gender: "",
      height: "" as any,
      weight: "" as any,
      activityLevel: "",
      planId: "",
    },
  });

  const watchedHeight = form.watch("height");
  const watchedWeight = form.watch("weight");
  const watchedAge = form.watch("age");
  const watchedGender = form.watch("gender");
  const watchedActivityLevel = form.watch("activityLevel");

  useEffect(() => {
    const calculateAll = async () => {
        const heightInMeters = Number(watchedHeight) / 100;
        const weightInKg = Number(watchedWeight);
        const ageInYears = Number(watchedAge);
        const gender = watchedGender;

        // BMI Calculation
        if (heightInMeters > 0 && weightInKg > 0) {
            const bmi = weightInKg / (heightInMeters * heightInMeters);
            let message = "", colorClass = "", suggestion = "";
            
            const targetWeight = 22 * (heightInMeters * heightInMeters);
            const weightDiff = weightInKg - targetWeight;

            if (bmi < 18.5) { 
                message = "Underweight";
                colorClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200";
                suggestion = `User should Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`;
            } else if (bmi < 25) { 
                message = "Normal Weight";
                colorClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200";
                suggestion = "User is in a healthy weight range.";
            } else if (bmi < 30) { 
                message = "Overweight";
                colorClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200";
                suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`;
            } else { 
                message = "Obesity";
                colorClass = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200";
                suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`;
            }
            setBmiResult({ value: bmi.toFixed(2), message, colorClass, suggestion });
        } else {
            setBmiResult(null);
        }

        // BMR Calculation
        let bmr = 0;
        if (weightInKg > 0 && heightInMeters > 0 && ageInYears > 0 && gender) {
            if(gender === 'male'){
                bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5;
            } else {
                bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161;
            }
            setBmrResult({ value: bmr.toFixed(0), message: "calories/day" });
        } else {
            setBmrResult(null);
        }
    };
    calculateAll();
  }, [watchedHeight, watchedWeight, watchedAge, watchedGender]);
  
  useEffect(() => {
    const calculateNewMacros = async () => {
        const weightInKg = Number(watchedWeight);
        const heightInCm = Number(watchedHeight);
        const ageInYears = Number(watchedAge);
        const calorieNeeds = Number(watchedActivityLevel);

        if (calorieNeeds > 0 && weightInKg > 0 && heightInCm > 0 && ageInYears > 0) {
            setIsCalculatingMacros(true);
            try {
                const result = await calculateMacros({
                    bmr: calorieNeeds,
                    weight: weightInKg,
                    height: heightInCm,
                    age: ageInYears,
                });
                setMacroResult(result);
            } catch (e) {
                console.error("Macro calculation failed:", e);
                setMacroResult(null);
            } finally {
                setIsCalculatingMacros(false);
            }
        } else {
            setMacroResult(null);
        }
    };
    calculateNewMacros();
  }, [watchedActivityLevel, watchedWeight, watchedHeight, watchedAge]);

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setVendor(user);
        if(user) {
            const vendorDoc = await getDoc(doc(db, 'vendors', user.uid));
            if(vendorDoc.exists()) {
                setVendorName(vendorDoc.data().name);
            }
        }
    });
    return () => unsubscribe();
  }, [auth, db]);

  useEffect(() => {
    if (!db) return;

    const fetchPlans = async () => {
      try {
        const plansCollectionRef = collection(db, "subscriptionPlans");
        const q = query(
            plansCollectionRef, 
            where("status", "==", "Active"), 
            where("vendorVisible", "==", true)
        );
        const data = await getDocs(q);
        const activePlans = data.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((plan) => (plan as any).planFor !== 'vendor') as Plan[];
        setPlans(activePlans);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch subscription plans." });
      }
    };
    fetchPlans();
  }, [db, toast]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!db || !vendor) return;
    setIsSubmitting(true);
    
    const selectedPlan = plans.find((p) => p.id === data.planId);
    if (!selectedPlan) {
        toast({ variant: "destructive", title: "Error", description: "Selected plan not found." });
        setIsSubmitting(false);
        return;
    }

    try {
        const result = await sendVendorCustomerWelcomeEmail({
            vendorId: vendor.uid,
            vendorName: vendorName,
            customerData: {
                name: data.name,
                email: data.email,
                mobile: data.mobile,
                planId: data.planId,
                activityLevel: data.activityLevel,
            },
            profileData: {
                name: data.name,
                email: data.email,
                age: data.age.toString(),
                gender: data.gender,
                height: data.height.toString(),
                weight: data.weight.toString(),
                protein: macroResult?.protein.toString(),
                carbs: macroResult?.carbs.toString(),
                fat: macroResult?.fat.toString(),
                fibre: macroResult?.fibre.toString(),
            },
        });

        toast({
          variant: "success",
          title: "Customer Created", 
          description: "Welcome email is being sent to the customer." 
        });
        
        router.push("/vendor/customers");

    } catch (error: any) {
        console.error("Error creating customer: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not create customer: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };
  
    const activityLevels = [
      { id: "sedentary", label: "Little or No Exercise", multiplier: 1.2 },
      { id: "light", label: "Light Exercise/Sports (1-3 Days/week)", multiplier: 1.375 },
      { id: "moderate", label: "Moderate Exercise/Sports (3-5 Days/week)", multiplier: 1.55 },
      { id: "hard", label: "Hard Exercise/Sports (6-7 Days/week)", multiplier: 1.725 },
      { id: "very-hard", label: "Very Hard Exercise/Sports & Physical Job", multiplier: 1.9 },
    ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/vendor/customers">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Customer</CardTitle>
            <CardDescription>
              Add a new customer to your managed list.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-4">Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="mobile" render={({ field }) => (
                        <FormItem><FormLabel>Mobile *</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField control={form.control} name="age" render={({ field }) => (
                        <FormItem><FormLabel>Age *</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Gender *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                            </Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="height" render={({ field }) => (
                        <FormItem><FormLabel>Height (cm) *</FormLabel><FormControl><Input type="number" placeholder="175" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="weight" render={({ field }) => (
                        <FormItem><FormLabel>Weight (kg) *</FormLabel><FormControl><Input type="number" placeholder="70" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                <FormField control={form.control} name="planId" render={({ field }) => (
                    <FormItem><FormLabel>Subscription Plan *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a plan for the customer" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {plans.map((plan) => (
                                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select><FormMessage /></FormItem>
                )}/>
                {bmrResult && (
                     <FormField
                        control={form.control}
                        name="activityLevel"
                        render={({ field }) => (
                            <FormItem className="space-y-3 pt-4">
                            <FormLabel>Daily Calorie Needs *</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-1"
                                >
                                {activityLevels.map(level => (
                                    <FormItem key={level.id} className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <RadioGroupItem value={String(parseFloat(bmrResult.value) * level.multiplier)} />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                           {level.label}: <span className="font-semibold text-primary">{(parseFloat(bmrResult.value) * level.multiplier).toFixed(0)} kcal</span>
                                        </FormLabel>
                                    </FormItem>
                                ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                )}
            </div>
            <div className="space-y-4 pt-12">
                {bmiResult && (
                    <Card className={cn("transition-all", bmiResult.colorClass)}>
                        <CardHeader>
                            <CardTitle>BMI Result</CardTitle>
                            <CardDescription>Body Mass Index</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-5xl font-bold">{bmiResult.value}</p>
                            <p className="text-lg font-semibold mt-2">{bmiResult.message}</p>
                            {bmiResult.suggestion && <p className="text-sm font-bold mt-2">{bmiResult.suggestion}</p>}
                        </CardContent>
                    </Card>
                )}
                <Card className="bg-amber-50 dark:bg-amber-900/20 relative">
                    <CardHeader><CardTitle>Daily Macronutrient Needs</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                       {macroResult ? (
                        <>
                            <p className="flex items-center gap-2"><Drumstick className="h-5 w-5 text-amber-600"/> Protein: <span className="font-bold ml-auto">{macroResult.protein.toFixed(0)}g</span></p>
                            <p className="flex items-center gap-2"><Wheat className="h-5 w-5 text-amber-600"/> Carbohydrates: <span className="font-bold ml-auto">{macroResult.carbs.toFixed(0)}g</span></p>
                            <p className="flex items-center gap-2"><Flame className="h-5 w-5 text-amber-600"/> Fat: <span className="font-bold ml-auto">{macroResult.fat.toFixed(0)}g</span></p>
                            <p className="flex items-center gap-2"><Leaf className="h-5 w-5 text-amber-600"/> Fibre: <span className="font-bold ml-auto">{macroResult.fibre.toFixed(0)}g</span></p>
                        </>
                       ) : (
                        <p className="text-sm text-muted-foreground">Select an activity level to estimate needs.</p>
                       )}
                    </CardContent>
                    {isCalculatingMacros && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                </Card>
            </div>
          </CardContent>
          <CardFooter className="max-w-4xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Adding Customer...' : 'Add Customer'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}



    

    
