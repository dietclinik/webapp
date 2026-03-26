
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, FormProvider, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  User,
  HeartPulse,
  FileCheck2,
  Loader2,
  PartyPopper,
  AlertCircle,
  Ruler,
  Camera,
} from "lucide-react";
import { format, addMonths, addDays } from "date-fns";
import { collection, doc, getDoc, getDocs, query, where, Timestamp, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { processNewCustomer } from "@/app/actions";
import type { ProcessCustomerInput } from "@/ai/flows/send-welcome-email-flow";
import { calculateMacros, type MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { calculateBodyFat } from "@/ai/flows/calculate-body-fat-flow";
import RazorpayButton from "@/components/razorpay-button";
import { Header } from "@/components/header";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { isPast } from 'date-fns';
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size';
import { Flame, Wheat, Drumstick, Leaf } from "lucide-react";


type Plan = {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  durationDays: number;
};

type ExistingCustomerData = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    address: string;
    bloodGroup: string;
    status: string;
    since: string;
    isNew: boolean;
    paymentStatus: string;
    subscriptionStartDate: Timestamp;
    subscriptionEndDate: Timestamp;
    customFields: Record<string, any>;
    planId: string;
    dietPlanId: string | null;
}

type ExistingProfileData = {
    age: string;
    gender: string;
    height: string;
    weight: string;
    healthProblems: string;
    allergies: string;
}

type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'switch';
  required: boolean;
  placeholder?: string;
  stepId?: 'registerPersonal' | 'registerBody';
};

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

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const baseSchema = z.object({
  name: z.string().min(2, "Your name is required."),
  email: z.string().email("Please enter a valid email."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  bloodGroup: z.string().min(1, "Blood group is required."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  neck: z.coerce.number().min(1, "Neck measurement is required."),
  waist: z.coerce.number().min(1, "Waist measurement is required."),
  hips: z.coerce.number().optional(),
  activityLevel: z.string().min(1, "Please select an activity level."),
  healthProblems: z.string().optional(),
  allergies: z.string().optional(),
  foodPreference: z.enum(["veg", "non-veg"]).optional(),
  smoking: z.enum(["yes", "no"]).optional(),
  alcohol: z.enum(["yes", "no"]).optional(),
  goal: z.string().optional(),
  consent: z.boolean().refine(val => val === true, "You must agree to the terms."),
  frontImage: z.instanceof(File).optional(),
  backImage: z.instanceof(File).optional(),
  leftImage: z.instanceof(File).optional(),
  rightImage: z.instanceof(File).optional(),
});


const activityLevels = [
  { id: "sedentary", label: "Little or No Exercise", multiplier: 1.2 },
  { id: "light", label: "Light Exercise/Sports (1-3 Days/week)", multiplier: 1.375 },
  { id: "moderate", label: "Moderate Exercise/Sports (3-5 Days/week)", multiplier: 1.55 },
  { id: "hard", label: "Hard Exercise/Sports (6-7 Days/week)", multiplier: 1.725 },
  { id: "very-hard", label: "Very Hard Exercise/Sports & Physical Job", multiplier: 1.9 },
];

type ImageUploadFieldProps = {
    control: Control<any>;
    name: "frontImage" | "backImage" | "leftImage" | "rightImage";
    label: string;
};

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ control, name, label }) => {
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            field.onChange(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <div className="relative w-full h-40 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground overflow-hidden">
                            {preview ? (
                                <Image src={preview} alt={`${label} preview`} fill objectFit="cover" />
                            ) : (
                                <div className="text-center">
                                    <Camera className="mx-auto h-8 w-8" />
                                    <p className="mt-2 text-sm">Click to upload</p>
                                </div>
                            )}
                            <Input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => handleFileChange(e, field)}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};

// Helper to convert file to Base64 Data URI
const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formSchema, setFormSchema] = useState(baseSchema);
  const [bmiResult, setBmiResult] = useState<BmiResult | null>(null);
  const [bmrResult, setBmrResult] = useState<BmrResult | null>(null);
  const [macroResult, setMacroResult] = useState<MacrosOutput | null>(null);
  const [bodyFatResult, setBodyFatResult] = useState<BodyFatResult | null>(null);
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);
  const [isCalculatingBodyFat, setIsCalculatingBodyFat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mobile: "",
      email: "",
      address: "",
      bloodGroup: "",
      age: "" as any,
      gender: "",
      height: "" as any,
      weight: "" as any,
      neck: "" as any,
      waist: "" as any,
      hips: "" as any,
      activityLevel: "",
      healthProblems: "",
      allergies: "",
      foodPreference: "veg",
      goal: "Weight Loss",
      consent: false
    },
  });

  const watchedHeight = form.watch("height");
  const watchedWeight = form.watch("weight");
  const watchedAge = form.watch("age");
  const watchedGender = form.watch("gender");
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

        // BMI Calculation
        if (heightInMeters > 0 && weightInKg > 0) {
            const bmi = weightInKg / (heightInMeters * heightInMeters);
            let message = "", colorClass = "", suggestion = "", suggestionColorClass = "";
            
            const targetWeight = 22 * (heightInMeters * heightInMeters);
            const weightDiff = weightInKg - targetWeight;

            if (bmi < 18.5) { 
                message = "Underweight"; 
                colorClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"; 
                suggestion = `You have to Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`;
                suggestionColorClass = "bg-blue-200 dark:bg-blue-800/50";
            } else if (bmi < 25) { 
                message = "Normal Weight"; 
                colorClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"; 
                suggestion = "You are in a healthy weight range.";
                suggestionColorClass = "bg-green-200 dark:bg-green-800/50";
            } else if (bmi < 30) { 
                message = "Overweight"; 
                colorClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200"; 
                suggestion = `You have to Lose ${weightDiff.toFixed(1)} kg to be Fit`;
                suggestionColorClass = "bg-orange-200 dark:bg-orange-800/50";
            } else { 
                message = "Obesity"; 
                colorClass = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200"; 
                suggestion = `You have to Lose ${weightDiff.toFixed(1)} kg to be Fit`;
                suggestionColorClass = "bg-red-200 dark:bg-red-800/50";
            }
            setBmiResult({ value: bmi.toFixed(2), message, colorClass, suggestion, suggestionColorClass });
        } else {
            setBmiResult(null);
        }

        // BMR Calculation (Mifflin-St Jeor)
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
    
    calculateBmiAndBmr();
  }, [watchedHeight, watchedWeight, watchedAge, watchedGender]);

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
                    const result = await calculateBodyFat({ gender: genderValue, height: heightCm, neck: neckCm, waist: waistCm, hips: hipsCm });
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
    if (!db || !planId) return;

    const fetchPlanDetails = async () => {
        const planDocRef = doc(db, "subscriptionPlans", planId);
        try {
            const docSnap = await getDoc(planDocRef);
            if(docSnap.exists()){
                setPlan({ ...docSnap.data(), id: docSnap.id } as Plan);
            } else {
                 toast({ variant: "destructive", title: "Error", description: "Subscription plan not found." });
                 router.push('/');
            }
        } catch(e) {
             toast({ variant: "destructive", title: "Error", description: "Could not fetch plan details." });
        }
    };
    
    const fetchCustomFields = async () => {
        const settingsDocRef = doc(db, "settings", "global");
        try {
            const docSnap = await getDoc(settingsDocRef);
            if (docSnap.exists() && docSnap.data().customFields?.customers) {
                const fetchedFields = docSnap.data().customFields.customers.filter((f: CustomField) => f.stepId === 'registerPersonal' || f.stepId === 'registerBody') as CustomField[];
                setCustomFields(fetchedFields);
                // Extend schema and default values logic here if needed, similar to AddCustomerPage
            }
        } catch (error) {
            console.error("Error fetching custom fields: ", error);
        }
    };
    
    fetchPlanDetails();
    fetchCustomFields();
  }, [db, planId, toast, router]);

  const steps = useMemo(() => [
    {
      id: "personalDetails",
      title: "Personal Details",
      icon: User,
      fields: ["name", "email", "mobile", "address", "bloodGroup", ...customFields.filter(f => f.stepId === 'registerPersonal').map(f => f.id)],
    },
    {
      id: "bodyComposition",
      title: "Body Composition",
      icon: Ruler,
      fields: ["age", "gender", "height", "weight", "neck", "waist", "hips", "activityLevel", "frontImage", "backImage", "leftImage", "rightImage", "goal", ...customFields.filter(f => f.stepId === 'registerBody').map(f => f.id)],
    },
    {
      id: "healthDetails",
      title: "Health Details",
      icon: HeartPulse,
      fields: ["healthProblems", "allergies", "foodPreference", "smoking", "alcohol"],
    },
    {
      id: "confirmAndPay",
      title: "Confirm & Pay",
      icon: FileCheck2,
      fields: ['consent'],
    },
  ], [customFields]);

  const findExistingCustomer = async (email: string, mobile: string) => {
    if(!db) return false;
    
    const customersRef = collection(db, "customers");
    
    // Check for email
    const emailQuery = query(customersRef, where("email", "==", email));
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
        return true;
    }

    // Check for mobile
    const mobileQuery = query(customersRef, where("mobile", "==", mobile));
    const mobileSnapshot = await getDocs(mobileQuery);
    if (!mobileSnapshot.empty) {
        return true;
    }
    
    return false;
  }

  const handleNext = async () => {
    const fieldsToValidate = steps[currentStep].fields as (keyof z.infer<typeof formSchema>)[];
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid) {
      if (currentStep === 0) {
        setIsLookingUp(true);
        const { email, mobile } = form.getValues();
        const customerExists = await findExistingCustomer(email, mobile);
        setIsLookingUp(false);
        if (customerExists) {
            toast({
                variant: 'destructive',
                title: 'Existing User',
                description: "The Mail ID or Mobile number you entered is already exist"
            });
            return;
        }
      }
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };
  
  const handlePaymentResult = async (success: boolean) => {
    if (!plan) return;
    const values = form.getValues();
    setIsSubmitting(true);

    let frontImageDataUri, backImageDataUri, leftImageDataUri, rightImageDataUri;
    if (values.frontImage) frontImageDataUri = await fileToDataURI(values.frontImage);
    if (values.backImage) backImageDataUri = await fileToDataURI(values.backImage);
    if (values.leftImage) leftImageDataUri = await fileToDataURI(values.leftImage);
    if (values.rightImage) rightImageDataUri = await fileToDataURI(values.rightImage);

    const startDate = new Date();
    let endDate = addMonths(startDate, plan.durationMonths || 0);
    endDate = addDays(endDate, plan.durationDays || 0);

    const customerInput: ProcessCustomerInput = {
      paymentSuccess: success,
      customerData: {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        address: values.address,
        bloodGroup: values.bloodGroup,
        planId: plan.id,
        dietPlanId: null,
        status: 'Active',
        since: format(startDate, "yyyy-MM-dd"),
        isNew: true,
        paymentStatus: success ? 'Paid' : 'Failed',
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        customFields: { activityLevel: values.activityLevel },
      },
      profileData: {
        name: values.name,
        email: values.email,
        age: values.age.toString(),
        gender: values.gender,
        foodPreference: values.foodPreference,
        height: values.height.toString(),
        weight: values.weight.toString(),
        healthProblems: values.healthProblems,
        allergies: values.allergies,
        protein: macroResult?.protein.toString(),
        carbs: macroResult?.carbs.toString(),
        fat: macroResult?.fat.toString(),
        fibre: macroResult?.fibre.toString(),
        goal: values.goal,
        smoking: values.smoking,
        alcohol: values.alcohol,
        frontImageDataUri,
        backImageDataUri,
        leftImageDataUri,
        rightImageDataUri,
      },
      bmiValue: bmiResult?.value,
      bmiMessage: bmiResult?.message
    };
    
    try {
        const { userId, message } = await processNewCustomer(customerInput);
        if (success) {
            toast({
                title: "Registration Successful!",
                description: "Your account is set. Check your email for login details."
            });
            router.push("/login");
        } else {
             toast({
                variant: "destructive",
                title: "Payment Failed",
                description: "Your details have been saved. The admin will review your application."
            });
             router.push("/");
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Registration Error", description: `An error occurred: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
};


  const renderCustomField = useCallback((field: CustomField) => {
    // Omitting for brevity, would be similar to AddCustomerPage
    return null;
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1 flex items-center justify-center">
        <div className="container py-12">
            <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex flex-col md:flex-row items-center gap-4">
                <Link href="/" className="self-start">
                    <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="text-center md:text-left">
                    <CardTitle>Register for: {plan?.name || "..."}</CardTitle>
                    <CardDescription>
                    Follow the steps to complete your registration.
                    </CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center mb-8 mx-auto">
                     <ol className="flex items-center w-full max-w-2xl">
                        {steps.map((step, index) => (
                            <li key={step.id} className={
                                cn("flex w-full items-center", 
                                index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block " : "",
                                index <= currentStep ? "after:border-primary " : "after:border-muted ",
                                index < currentStep ? "text-primary " : "text-muted-foreground")
                            }>
                                <span className={cn("flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ",
                                    index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                <step.icon className="w-5 h-5 lg:w-6 lg:h-6" />
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>

                <FormProvider {...form}>
                <form>
                    {currentStep === 0 && (
                    <div className="space-y-4 max-w-lg mx-auto">
                        <h3 className="text-xl font-semibold text-center md:text-left mb-4">Personal Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="mobile" render={({ field }) => (
                                <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="john@example.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Main St, City" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                            <FormItem><FormLabel>Blood Group *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                                    <SelectContent>{bloodGroups.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                        {customFields.filter(f => f.stepId === 'registerPersonal').map(renderCustomField)}
                    </div>
                    )}
                    {currentStep === 1 && (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-center md:text-left mb-4">Body Composition</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="age" render={({ field }) => (
                                        <FormItem><FormLabel>Age *</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="gender" render={({ field }) => (
                                        <FormItem><FormLabel>Gender *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="height" render={({ field }) => (
                                        <FormItem><FormLabel>Height (cm) *</FormLabel><FormControl><Input type="number" placeholder="e.g. 175" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="weight" render={({ field }) => (
                                        <FormItem><FormLabel>Weight (kg) *</FormLabel><FormControl><Input type="number" placeholder="e.g. 70" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="neck" render={({ field }) => (
                                        <FormItem><FormLabel>Neck (cm) *</FormLabel><FormControl><Input type="number" placeholder="e.g. 38" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="waist" render={({ field }) => (
                                        <FormItem><FormLabel>Waist (cm) *</FormLabel><FormControl><Input type="number" placeholder="e.g. 90" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                {watchedGender === 'female' && (
                                     <FormField control={form.control} name="hips" render={({ field }) => (<FormItem><FormLabel>Hips (cm) *</FormLabel><FormControl><Input type="number" placeholder="e.g. 100" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                )}
                                <FormField control={form.control} name="goal" render={({ field }) => (
                                    <FormItem><FormLabel>Your Goal *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select your primary goal" /></SelectTrigger></FormControl>
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
                                {customFields.filter(f => f.stepId === 'registerBody').map(renderCustomField)}
                            </div>
                            <div className="space-y-4 md:pt-12">
                                {bmiResult && (
                                    <Card className={cn("transition-all", bmiResult.colorClass)}>
                                        <CardHeader>
                                            <CardTitle>BMI Result</CardTitle>
                                            <CardDescription>Body Mass Index</CardDescription>
                                        </CardHeader>
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
                                       {macroResult ? (
                                        <>
                                            <p className="flex items-center gap-2"><Drumstick className="h-5 w-5 text-amber-600"/> Protein: <span className="font-bold ml-auto">{macroResult.protein.toFixed(0)}g</span></p>
                                            <p className="flex items-center gap-2"><Wheat className="h-5 w-5 text-amber-600"/> Carbohydrates: <span className="font-bold ml-auto">{macroResult.carbs.toFixed(0)}g</span></p>
                                            <p className="flex items-center gap-2"><Flame className="h-5 w-5 text-amber-600"/> Fat: <span className="font-bold ml-auto">{macroResult.fat.toFixed(0)}g</span></p>
                                            <p className="flex items-center gap-2"><Leaf className="h-5 w-5 text-amber-600"/> Fibre: <span className="font-bold ml-auto">{macroResult.fibre.toFixed(0)}g</span></p>
                                        </>
                                       ) : (
                                        <p className="text-sm text-muted-foreground">Select an activity level to estimate your needs.</p>
                                       )}
                                    </CardContent>
                                     {isCalculatingMacros && (
                                        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center rounded-lg">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-center mt-8 mb-4">Body Images (Optional)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <ImageUploadField control={form.control} name="frontImage" label="Front Image" />
                                <ImageUploadField control={form.control} name="backImage" label="Back Image" />
                                <ImageUploadField control={form.control} name="leftImage" label="Left Side Image" />
                                <ImageUploadField control={form.control} name="rightImage" label="Right Side Image" />
                            </div>
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
                        <FormField
                            control={form.control}
                            name="healthProblems"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Existing Health Problems (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Diabetes, Blood Pressure, Thyroid..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="allergies"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Food or Medicine Allergies (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Peanuts, Gluten, specific medicine names..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4 pt-4">
                             <FormField control={form.control} name="smoking" render={({ field }) => (
                                <FormItem><FormLabel>Do you smoke?</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="no">No</SelectItem>
                                            <SelectItem value="yes">Yes</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="alcohol" render={({ field }) => (
                                <FormItem><FormLabel>Do you drink alcohol?</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="no">No</SelectItem>
                                            <SelectItem value="yes">Yes</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                        </div>
                    </div>
                    )}
                     {currentStep === 3 && (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <h3 className="text-xl font-semibold text-center mb-4">Confirm &amp; Pay</h3>
                        
                        <Card>
                            <CardContent className="p-4 md:p-6 grid grid-cols-2 gap-4 text-sm">
                                <div className="col-span-2 font-bold text-base text-primary">{plan?.name} - ₹{plan?.price}</div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Name</p><p>{form.getValues().name}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Email</p><p className="truncate">{form.getValues().email}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Mobile</p><p>{form.getValues().mobile}</p></div>
                                <div className="space-y-1 col-span-2"><p className="font-semibold text-muted-foreground">Address</p><p>{form.getValues().address}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Blood Group</p><p>{form.getValues().bloodGroup}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Age</p><p>{form.getValues().age}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Gender</p><p className="capitalize">{form.getValues().gender}</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Height</p><p>{form.getValues().height} cm</p></div>
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Weight</p><p>{form.getValues().weight} kg</p></div>
                                {bmiResult && (<div className="space-y-1"><p className="font-semibold text-muted-foreground">BMI</p><p>{bmiResult.value} <span className="text-muted-foreground">({bmiResult.message})</span></p></div>)}
                                <div className="space-y-1"><p className="font-semibold text-muted-foreground">Calorie Goal</p><p>{parseFloat(form.getValues().activityLevel).toFixed(0)} <span className="text-muted-foreground">kcal/day</span></p></div>
                                <div className="space-y-1 col-span-2"><p className="font-semibold text-muted-foreground">Health Problems</p><p>{form.getValues().healthProblems || 'None specified'}</p></div>
                                <div className="space-y-1 col-span-2"><p className="font-semibold text-muted-foreground">Allergies</p><p>{form.getValues().allergies || 'None specified'}</p></div>
                            </CardContent>
                        </Card>

                        <FormField control={form.control} name="consent" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Acknowledge &amp; Consent</FormLabel>
                                    <FormDescription>I acknowledge that I have read and agree to the terms of service and privacy policy.</FormDescription>
                                    <FormMessage />
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    )}
                </form>
                </FormProvider>
            </CardContent>
            <CardFooter>
                <div className="w-full flex justify-between">
                <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0 || isSubmitting}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                {currentStep < steps.length - 1 ? (
                    <Button onClick={handleNext} disabled={isSubmitting || isLookingUp}>
                    {(isLookingUp) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                ) : (
                    plan && plan.price > 0 ? (
                        <RazorpayButton 
                            planName={plan.name}
                            amount={plan.price}
                            customerName={form.getValues().name!}
                            customerEmail={form.getValues().email!}
                            customerPhone={form.getValues().mobile!}
                            onPaymentSuccess={(res) => handlePaymentResult(true)}
                            onPaymentError={(err) => handlePaymentResult(false)}
                            disabled={isSubmitting || !form.getValues().consent}
                            buttonText="Submit &amp; Pay"
                        />
                    ) : (
                         <Button 
                            onClick={form.handleSubmit(() => handlePaymentResult(true))} 
                            disabled={isSubmitting || !form.formState.isValid}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Complete Registration
                        </Button>
                    )
                )}
                </div>
            </CardFooter>
            </Card>
        </div>
      </main>
    </div>
  );
}
