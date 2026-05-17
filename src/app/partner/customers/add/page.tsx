
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  User,
  HeartPulse,
  Loader2,
  ShieldAlert,
  FileCheck2,
  Leaf,
  Drumstick,
} from "lucide-react";
import { collection, getDocs, where, query, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { calculateMacros, type MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { calculateBodyFat } from "@/ai/flows/calculate-body-fat-flow";
import { sendPartnerCustomerWelcomeEmail } from "@/ai/flows/send-partner-customer-welcome-email-flow";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Flame, Wheat, Ruler } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Plan = {
  id: string;
  name: string;
};

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  planId: z.string().min(1, "Please select a subscription plan."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  neck: z.coerce.number().min(1, "Neck measurement is required."),
  waist: z.coerce.number().min(1, "Waist measurement is required."),
  hips: z.coerce.number().optional(),
  activityLevel: z.string().optional(),
  healthProblems: z.string().optional(),
  allergies: z.string().optional(),
  goal: z.string().optional(),
  foodPreference: z.enum(["veg", "non-veg"]).optional(),
  moneyBackChallenge: z.boolean().default(false),
  challengeDuration: z.coerce.number().optional(),
  consent: z.boolean().refine(val => val === true, "You must confirm the details are correct."),
}).refine(data => data.gender !== 'female' || (data.gender === 'female' && data.hips && data.hips > 0), {
    message: "Hips measurement is required for females.",
    path: ["hips"],
});


type CustomerFormData = z.infer<typeof formSchema>;

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

type BodyFatResult = {
    value: string;
    message: string;
    colorClass: string;
};

const activityLevels = [
  { id: "sedentary", label: "Little or No Exercise", multiplier: 1.2 },
  { id: "light", label: "Light Exercise/Sports (1-3 Days/week)", multiplier: 1.375 },
  { id: "moderate", label: "Moderate Exercise/Sports (3-5 Days/week)", multiplier: 1.55 },
  { id: "hard", label: "Hard Exercise/Sports (6-7 Days/week)", multiplier: 1.725 },
  { id: "very-hard", label: "Very Hard Exercise/Sports & Physical Job", multiplier: 1.9 },
];

export default function PartnerAddCustomerPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partner, setPartner] = useState<FirebaseUser | null>(null);
  const [partnerName, setPartnerName] = useState<string>('');
  const [customerLimit, setCustomerLimit] = useState<number | null>(null);
  const [currentCustomerCount, setCurrentCustomerCount] = useState(0);
  const [bmiResult, setBmiResult] = useState<BmiResult | null>(null);
  const [bmrResult, setBmrResult] = useState<BmrResult | null>(null);
  const [macroResult, setMacroResult] = useState<MacrosOutput | null>(null);
  const [bodyFatResult, setBodyFatResult] = useState<BodyFatResult | null>(null);
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);
  const [isCalculatingBodyFat, setIsCalculatingBodyFat] = useState(false);

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      planId: "",
      age: undefined,
      gender: "",
      height: undefined,
      weight: undefined,
      neck: undefined,
      waist: undefined,
      hips: undefined,
      activityLevel: "",
      healthProblems: "",
      allergies: "",
      goal: "Weight Loss",
      foodPreference: "veg",
      moneyBackChallenge: false,
      challengeDuration: 30,
      consent: false,
    },
  });

  const watchedHeight = form.watch("height");
  const watchedWeight = form.watch("weight");
  const watchedAge = form.watch("age");
  const watchedGender = form.watch("gender");
  const watchedActivityLevel = form.watch("activityLevel");
  const watchedNeck = form.watch("neck");
  const watchedWaist = form.watch("waist");
  const watchedHips = form.watch("hips");
  const watchedMoneyBackChallenge = form.watch("moneyBackChallenge");


  useEffect(() => {
    const calculateBmiAndBmr = () => {
        const heightInMeters = Number(watchedHeight) / 100;
        const weightInKg = Number(watchedWeight);
        const ageInYears = Number(watchedAge);
        const gender = watchedGender;

        if (heightInMeters > 0 && weightInKg > 0) {
            const bmi = weightInKg / (heightInMeters * heightInMeters);
            let message = "", colorClass = "", suggestion = "";
            
            const targetWeight = 22 * (heightInMeters * heightInMeters);
            const weightDiff = weightInKg - targetWeight;

            if (bmi < 18.5) { message = "Underweight"; colorClass = "bg-blue-100"; suggestion = `User should Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`; }
            else if (bmi < 25) { message = "Normal"; colorClass = "bg-green-100"; suggestion = "User is in a healthy weight range."; }
            else if (bmi < 30) { message = "Overweight"; colorClass = "bg-orange-100"; suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`; }
            else { message = "Obesity"; colorClass = "bg-red-100"; suggestion = `User should Lose ${weightDiff.toFixed(1)} kg to be Fit`; }
            setBmiResult({ value: bmi.toFixed(2), message, colorClass, suggestion });
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
        const weightInKg = Number(watchedWeight);
        const heightInCm = Number(watchedHeight);
        const ageInYears = Number(watchedAge);
        const calorieNeeds = Number(watchedActivityLevel);

        if (calorieNeeds > 0 && weightInKg > 0 && heightInCm > 0 && ageInYears > 0) {
            setIsCalculatingMacros(true);
            try {
                const result = await calculateMacros({ bmr: calorieNeeds, weight: weightInKg, height: heightInCm, age: ageInYears });
                setMacroResult(result);
            } catch (e) { setMacroResult(null); } finally { setIsCalculatingMacros(false); }
        } else { setMacroResult(null); }
    };
    if (watchedActivityLevel) {
        calculateNewMacros();
    }
  }, [watchedActivityLevel, watchedWeight, watchedHeight, watchedAge]);
  
  useEffect(() => {
    const calculateNewBodyFat = async () => {
        const heightCm = Number(watchedHeight);
        const neckCm = Number(watchedNeck);
        const waistCm = Number(watchedWaist);
        const hipsCm = Number(watchedHips);
        const genderValue = watchedGender as "male" | "female";

        if (heightCm > 0 && neckCm > 0 && waistCm > 0) {
            const payload: { gender: "male" | "female"; height: number; neck: number; waist: number; hips?: number; } = {
                gender: genderValue,
                height: heightCm,
                neck: neckCm,
                waist: waistCm,
            };
            if(genderValue === 'female' && hipsCm > 0) {
                payload.hips = hipsCm;
            } else if (genderValue === 'female' && (!hipsCm || hipsCm <= 0)) {
                return; // Don't calculate if female and hips not provided
            }

            setIsCalculatingBodyFat(true);
            try {
                const result = await calculateBodyFat(payload);
                const bfp = result.bodyFatPercentage;
                let message = "", colorClass = "";
                
                if (genderValue === 'male') {
                    if (bfp < 6) { message = "Essential Fat"; colorClass = "bg-blue-100"; }
                    else if (bfp < 14) { message = "Athletes"; colorClass = "bg-green-100"; }
                    else if (bfp < 18) { message = "Fitness"; colorClass = "bg-green-100"; }
                    else if (bfp < 25) { message = "Average"; colorClass = "bg-orange-100"; }
                    else { message = "Obese"; colorClass = "bg-red-100"; }
                } else { // female
                    if (bfp < 14) { message = "Essential Fat"; colorClass = "bg-blue-100"; }
                    else if (bfp < 21) { message = "Athletes"; colorClass = "bg-green-100"; }
                    else if (bfp < 25) { message = "Fitness"; colorClass = "bg-green-100"; }
                    else if (bfp < 32) { message = "Average"; colorClass = "bg-orange-100"; }
                    else { message = "Obese"; colorClass = "bg-red-100"; }
                }

                setBodyFatResult({ value: bfp.toFixed(1), message, colorClass });

            } catch (e) {
                console.error("Body fat calculation failed:", e);
                setBodyFatResult(null);
            } finally {
                setIsCalculatingBodyFat(false);
            }
        } else {
            setBodyFatResult(null);
        }
    };
    calculateNewBodyFat();
}, [watchedHeight, watchedNeck, watchedWaist, watchedHips, watchedGender]);

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setPartner(user);
        if(user) {
            const vendorDoc = await getDoc(doc(db, 'vendors', user.uid));
            if(vendorDoc.exists()) {
                const vendorData = vendorDoc.data();
                setPartnerName(vendorData.name);
                
                if (vendorData.challenge === 'FITTBOSS') {
                    setCustomerLimit(vendorData.maxCustomers || null);
                } else if (vendorData.planId) {
                    const planDoc = await getDoc(doc(db, 'subscriptionPlans', vendorData.planId));
                    if(planDoc.exists()){ setCustomerLimit(planDoc.data().maxCustomers || null); }
                } else { 
                    setCustomerLimit(0); 
                }
            }
            const customerQuery = query(collection(db, "customers"), where("vendorId", "==", user.uid));
            const customerSnapshot = await getDocs(customerQuery);
            setCurrentCustomerCount(customerSnapshot.size);
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
          where("vendorVisible", "==", true),
          where("planFor", "==", "vendor_customer")
        );
        const data = await getDocs(q);
        const activePlans = data.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Plan[];
        setPlans(activePlans);
      } catch (error) { toast({ variant: "destructive", title: "Error", description: "Could not fetch subscription plans." }); }
    };
    fetchPlans();
  }, [db, toast]);

  const steps = [
      { id: "customerDetails", title: "Customer", icon: User, fields: ["name", "email", "mobile", "planId"] },
      { id: "healthProfile", title: "Health", icon: Ruler, fields: ["age", "gender", "height", "weight", "neck", "waist", "hips", "activityLevel", "goal"] },
      { id: "healthIssues", title: "Issues", icon: HeartPulse, fields: ["healthProblems", "allergies", "foodPreference"] },
      { id: "confirmation", title: "Confirm", icon: FileCheck2, fields: ["consent", "moneyBackChallenge"] },
  ];

  const handleNext = async () => {
    const fieldsToValidate = steps[currentStep].fields as (keyof CustomerFormData)[];
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = async (data: CustomerFormData) => {
    if (!db || !partner) return;
    setIsSubmitting(true);
    
    const selectedPlan = plans.find((p) => p.id === data.planId);
    if (!selectedPlan) {
        toast({ variant: "destructive", title: "Error", description: "Selected plan not found." });
        setIsSubmitting(false);
        return;
    }

    try {
        const result = await sendPartnerCustomerWelcomeEmail({
            partnerId: partner.uid,
            partnerName: partnerName,
            customerData: {
                name: data.name, email: data.email, mobile: data.mobile, planId: data.planId,
                activityLevel: data.activityLevel,
                moneyBackChallenge: data.moneyBackChallenge,
                challengeDuration: data.challengeDuration,
            },
            profileData: {
                name: data.name, email: data.email, age: data.age.toString(), gender: data.gender,
                height: data.height.toString(), weight: data.weight.toString(),
                protein: macroResult?.protein.toString(), carbs: macroResult?.carbs.toString(),
                fat: macroResult?.fat.toString(), fibre: macroResult?.fibre.toString(),
                healthProblems: data.healthProblems, allergies: data.allergies, goal: data.goal,
                smoking: "no",
                alcohol: "no",
            }
        });
        if (result.userId) {
            toast({ variant: "success", title: "Customer Added", description: "A welcome email is being sent." });
            router.push("/partner/customers");
        } else { throw new Error(result.message); }
    } catch (error: any) {
        console.error("Error creating customer: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not create customer: ${error.message}` });
    } finally { setIsSubmitting(false); }
  };

  const isLimitReached = customerLimit !== null && currentCustomerCount >= customerLimit;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/partner/customers">
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <CardTitle>Add New Customer</CardTitle>
            <CardDescription>Add a new customer to your managed list.</CardDescription>
          </div>
        </div>
      </CardHeader>
      {isLimitReached ? (
        <CardContent>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Customer Limit Reached</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-4 mt-2">
                    <p>You have reached your limit of {customerLimit} customers. To add more, please upgrade your subscription.</p>
                     <Button asChild><Link href="/partner/subscription">Upgrade Plan</Link></Button>
                </AlertDescription>
            </Alert>
        </CardContent>
      ) : (
      <FormProvider {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
             <div className="flex items-center justify-center mb-8 mx-auto">
                <ol className="flex items-center w-full max-w-lg">
                    {steps.map((step, index) => (
                        <li key={step.id} className={cn("flex w-full items-center", index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block " : "", index <= currentStep ? "after:border-primary " : "after:border-muted ", index < currentStep ? "text-primary " : "text-muted-foreground")}>
                            <TooltipProvider><Tooltip>
                                <TooltipTrigger>
                                <span className={cn("flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ", index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <step.icon className="w-5 h-5 lg:w-6 lg:h-6" />
                                </span>
                                </TooltipTrigger>
                                <TooltipContent><p>{step.title}</p></TooltipContent>
                            </Tooltip></TooltipProvider>
                        </li>
                    ))}
                </ol>
            </div>
            {currentStep === 0 && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="mobile" render={({ field }) => (<FormItem><FormLabel>Mobile *</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="planId" render={({ field }) => (<FormItem><FormLabel>Subscription Plan *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a plan for the customer" /></SelectTrigger></FormControl>
                            <SelectContent>{plans.map((plan) => (<SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>))}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )}/>
                </div>
            )}
            {currentStep === 1 && (
                 <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center md:text-left mb-4">Body Composition</h3>
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age *</FormLabel><FormControl><Input type="number" placeholder="30" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height (cm) *</FormLabel><FormControl><Input type="number" placeholder="175" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (kg) *</FormLabel><FormControl><Input type="number" placeholder="70" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="neck" render={({ field }) => (<FormItem><FormLabel>Neck (cm) *</FormLabel><FormControl><Input type="number" placeholder="38" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist (cm) *</FormLabel><FormControl><Input type="number" placeholder="90" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        {watchedGender === 'female' && (
                             <FormField control={form.control} name="hips" render={({ field }) => (<FormItem><FormLabel>Hips (cm) *</FormLabel><FormControl><Input type="number" placeholder="100" value={field.value || ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                        )}
                        <FormField control={form.control} name="goal" render={({ field }) => (
                            <FormItem><FormLabel>Customer Goal *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select primary goal" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Weight Loss">Weight Loss</SelectItem>
                                        <SelectItem value="Weight Gain">Weight Gain</SelectItem>
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                        {bmrResult && (
                             <FormField
                                control={form.control}
                                name="activityLevel"
                                render={({ field }) => (
                                    <FormItem className="space-y-3 pt-4"><FormLabel>Daily Calorie Needs *</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">{activityLevels.map(level => (<FormItem key={level.id} className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value={String(parseFloat(bmrResult.value) * level.multiplier)} /></FormControl><FormLabel className="font-normal">{level.label}: <span className="font-semibold text-primary">{(parseFloat(bmrResult.value) * level.multiplier).toFixed(0)} kcal</span></FormLabel></FormItem>))}</RadioGroup></FormControl><FormMessage /></FormItem>
                            )}/>
                        )}
                    </div>
                    <div className="space-y-4 md:pt-12">
                         {bmiResult && (
                            <Card className={cn("transition-all", bmiResult.colorClass)}><CardHeader><CardTitle>BMI Result</CardTitle><CardDescription>Body Mass Index</CardDescription></CardHeader><CardContent className="text-center"><p className="text-5xl font-bold">{bmiResult.value}</p><p className="text-lg font-semibold mt-2">{bmiResult.message}</p>{bmiResult.suggestion && <p className="text-sm font-bold mt-2">{bmiResult.suggestion}</p>}</CardContent></Card>
                         )}
                         {bodyFatResult && (
                            <Card className={cn("transition-all", bodyFatResult.colorClass)}>
                                <CardHeader><CardTitle>Body Fat Estimate</CardTitle></CardHeader>
                                <CardContent className="text-center">
                                     {isCalculatingBodyFat ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> :
                                        <>
                                            <p className="text-5xl font-bold">{bodyFatResult.value}%</p>
                                            <p className="text-lg font-semibold mt-2">{bodyFatResult.message}</p>
                                        </>
                                     }
                                </CardContent>
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
            )}
             {currentStep === 2 && (
                <div className="space-y-4 max-w-lg mx-auto">
                    <h3 className="text-xl font-semibold text-center mb-4">Health Details</h3>
                      <FormField
                        control={form.control}
                        name="foodPreference"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Preferred Food Type</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="veg" /></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2"><Leaf className="h-4 w-4 text-green-600"/>Veg</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="non-veg" /></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2"><Drumstick className="h-4 w-4 text-red-600"/>Non-Veg</FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField control={form.control} name="healthProblems" render={({ field }) => (
                        <FormItem><FormLabel>Existing Health Problems (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Diabetes, Blood Pressure, Thyroid..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="allergies" render={({ field }) => (
                        <FormItem><FormLabel>Food or Medicine Allergies (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Peanuts, Gluten, specific medicine names..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            )}
            {currentStep === 3 && (
                 <div className="space-y-4 max-w-xl mx-auto">
                    <h3 className="text-xl font-semibold text-center mb-4">Confirm & Create</h3>
                    <Card><CardContent className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div className="col-span-2 font-bold text-base text-primary">{plans.find(p => p.id === form.getValues().planId)?.name}</div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Name</p><p>{form.getValues().name}</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Email</p><p className="truncate">{form.getValues().email}</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Mobile</p><p>{form.getValues().mobile}</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Age</p><p>{form.getValues().age}</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Gender</p><p className="capitalize">{form.getValues().gender}</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Height</p><p>{form.getValues().height} cm</p></div><div className="space-y-1"><p className="font-semibold text-muted-foreground">Weight</p><p>{form.getValues().weight} kg</p></div>{bmiResult && (<div className="space-y-1"><p className="font-semibold text-muted-foreground">BMI</p><p>{bmiResult.value} <span className="text-muted-foreground">({bmiResult.message})</span></p></div>)}<div className="space-y-1"><p className="font-semibold text-muted-foreground">Calorie Goal</p><p>{parseFloat(form.getValues().activityLevel).toFixed(0)} <span className="text-muted-foreground">kcal/day</span></p></div></CardContent></Card>
                     <FormField control={form.control} name="moneyBackChallenge" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-x-3 space-y-0 rounded-md border p-4">
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Enroll in Money Back Challenge</FormLabel>
                                </div>
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                     {watchedMoneyBackChallenge && (
                         <FormField control={form.control} name="challengeDuration" render={({ field }) => (
                            <FormItem><FormLabel>Challenge Duration (Days) *</FormLabel><FormControl><Input type="number" placeholder="e.g., 30" {...field} /></FormControl><FormMessage /></FormItem>
                         )} />
                     )}
                    <FormField control={form.control} name="consent" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>Confirmation</FormLabel>
                                <FormDescription>I confirm that the details provided are correct and I have the customer's consent to create this account.</FormDescription>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )} />
                </div>
            )}
          </CardContent>
          <CardFooter className="max-w-4xl mx-auto">
             <div className="w-full flex justify-between">
                <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 0 || isSubmitting}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                {currentStep < steps.length - 1 ? (<Button type="button" onClick={handleNext}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Next <ChevronRight className="ml-2 h-4 w-4" /></Button>) : (<Button type="submit" disabled={isSubmitting || !form.getValues().consent}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isSubmitting ? 'Adding Customer...' : 'Add Customer'}</Button>)}
              </div>
          </CardFooter>
        </form>
      </FormProvider>
      )}
    </Card>
  );
}

    