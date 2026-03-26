

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
  Leaf,
  Drumstick,
} from "lucide-react";
import { format, addMonths, addDays } from "date-fns";
import { collection, addDoc, getDocs, doc, Timestamp, setDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { processNewCustomer } from "@/app/actions";

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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


type Plan = {
  id: string;
  name: string;
  durationMonths: number;
  durationDays: number;
};

type DietPlan = {
  id: string;
  name: string;
};

type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'switch';
  required: boolean;
  placeholder?: string;
  stepId?: 'personalDetails' | 'bodyMeasurements' | 'assignPlan';
};

type BmiResult = {
  value: string;
  message: string;
  colorClass: string;
};

const baseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits."),
  age: z.coerce.number().min(1, "Age is required."),
  gender: z.string().min(1, "Gender is required."),
  foodPreference: z.enum(["veg", "non-veg"]).optional(),
  height: z.coerce.number().min(1, "Height is required."),
  weight: z.coerce.number().min(1, "Weight is required."),
  healthProblems: z.string().optional(),
  allergies: z.string().optional(),
  planId: z.string().min(1, "Please select a subscription plan."),
  dietPlanId: z.string().optional(),
  hips: z.coerce.number().optional(),
});


export default function AddCustomerPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formSchema, setFormSchema] = useState(() => baseSchema);
  const [bmiResult, setBmiResult] = useState<BmiResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      age: "" as any,
      gender: "",
      foodPreference: "veg",
      height: "" as any,
      weight: "" as any,
      healthProblems: "",
      allergies: "",
      planId: "",
      dietPlanId: "",
      hips: "" as any,
    },
  });

  const watchedHeight = form.watch("height");
  const watchedWeight = form.watch("weight");
  const watchedGender = form.watch("gender");


  useEffect(() => {
    let currentSchema = baseSchema;
    if (watchedGender === 'female') {
      currentSchema = baseSchema.extend({
        hips: z.coerce.number().min(1, "Hips measurement is required for females."),
      });
    }
    setFormSchema(() => currentSchema);
  }, [watchedGender]);


  useEffect(() => {
    const heightInMeters = Number(watchedHeight) / 100;
    const weightInKg = Number(watchedWeight);

    if (heightInMeters > 0 && weightInKg > 0) {
      const bmi = weightInKg / (heightInMeters * heightInMeters);
      let message = "";
      let colorClass = "";

      if (bmi < 18.5) {
        message = "Underweight";
        colorClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200";
      } else if (bmi >= 18.5 && bmi < 25) {
        message = "Normal Weight";
        colorClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200";
      } else if (bmi >= 25 && bmi < 30) {
        message = "Overweight";
        colorClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200";
      } else {
        message = "Obesity";
        colorClass = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200";
      }
      setBmiResult({ value: bmi.toFixed(2), message, colorClass });
    } else {
      setBmiResult(null);
    }
  }, [watchedHeight, watchedWeight]);

  useEffect(() => {
    if (!db) return;

    const fetchPlans = async () => {
      try {
        const plansCollectionRef = collection(db, "subscriptionPlans");
        const data = await getDocs(plansCollectionRef);
        const activePlans = data.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((plan) => (plan as any).status === "Active") as Plan[];
        setPlans(activePlans);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch subscription plans." });
      }
    };

    const fetchDietPlans = async () => {
      try {
        const dietPlansCollectionRef = collection(db, "dietPlans");
        const data = await getDocs(dietPlansCollectionRef);
        const fetchedPlans = data.docs.map((doc) => ({
          name: doc.data().name,
          id: doc.id,
        })) as DietPlan[];
        setDietPlans(fetchedPlans);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch diet plans." });
      }
    };

    fetchPlans();
    fetchDietPlans();
  }, [db, toast]);

  useEffect(() => {
    if (!db) return;
    const fetchCustomFields = async () => {
        const settingsDocRef = doc(db, "settings", "global");
        try {
            const docSnap = await getDoc(settingsDocRef);
            if (docSnap.exists() && docSnap.data().customFields?.customers) {
                const fetchedFields = docSnap.data().customFields.customers as CustomField[];
                setCustomFields(fetchedFields);
                
                let dynamicSchema = baseSchema;
                 if (form.getValues().gender === 'female') {
                    dynamicSchema = dynamicSchema.extend({
                        hips: z.coerce.number().min(1, "Hips measurement is required for females."),
                    });
                }
                const newDefaultValues: { [key: string]: any } = {};

                fetchedFields.forEach(field => {
                    let fieldSchema;
                    switch (field.type) {
                        case 'number':
                            fieldSchema = z.coerce.number();
                            newDefaultValues[field.id] = '' as any;
                            break;
                        case 'date':
                            fieldSchema = z.date().optional().nullable();
                             newDefaultValues[field.id] = null;
                            break;
                        case 'switch':
                            fieldSchema = z.boolean();
                            newDefaultValues[field.id] = false;
                            break;
                        default:
                            fieldSchema = z.string();
                            newDefaultValues[field.id] = "";
                    }

                    if (field.required) {
                        if (field.type === 'switch') {
                           fieldSchema = fieldSchema.refine(val => val === true, {
                                message: `${field.label} is required.`,
                            });
                        } else if(field.type !== 'date') {
                             fieldSchema = (fieldSchema as z.ZodString | z.ZodNumber).min(1 as any, `${field.label} is required.`);
                        } else {
                            fieldSchema = fieldSchema.refine(val => val !== null && val !== undefined, {
                                message: `${field.label} is required.`,
                            });
                        }
                    } else {
                        fieldSchema = fieldSchema.optional();
                    }
                    dynamicSchema = dynamicSchema.extend({ [field.id]: fieldSchema });
                });
                
                setFormSchema(() => dynamicSchema);
                const defaultValuesToSet = {...form.formState.defaultValues, ...newDefaultValues};
                form.reset(defaultValuesToSet);
            }
        } catch (error) {
            console.error("Error fetching custom fields: ", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not load custom fields." });
        }
    };
    fetchCustomFields();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, toast]);

  const steps = useMemo(() => [
    {
      id: "personalDetails",
      title: "Personal",
      icon: User,
      fields: ["name", "email", "mobile", ...customFields.filter(f => f.stepId === 'personalDetails').map(f => f.id)],
    },
    {
      id: "healthDetails",
      title: "Health",
      icon: HeartPulse,
      fields: ["age", "gender", "height", "weight", "hips", "foodPreference", "healthProblems", "allergies", ...customFields.filter(f => f.stepId === 'bodyMeasurements').map(f => f.id)],
    },
    {
      id: "assignPlan",
      title: "Plan",
      icon: BookCopy,
      fields: ["planId", "dietPlanId", ...customFields.filter(f => f.stepId === 'assignPlan').map(f => f.id)],
    },
  ], [customFields]);

  const handleNext = async () => {
    const fieldsToValidate = steps[currentStep].fields as (keyof z.infer<typeof formSchema>)[];
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!db) return;
    setIsSubmitting(true);
    
    const selectedPlan = plans.find((p) => p.id === data.planId);
    if (!selectedPlan) {
        toast({ variant: "destructive", title: "Error", description: "Selected plan not found." });
        setIsSubmitting(false);
        return;
    }
    const startDate = new Date();
    let endDate = addMonths(startDate, selectedPlan.durationMonths || 0);
    endDate = addDays(endDate, selectedPlan.durationDays || 0);

    const customFieldValues: { [key: string]: any } = {};
    customFields.forEach(field => {
        if (data[field.id] !== undefined) {
            customFieldValues[field.id] = data[field.id];
        }
    });

    try {
        const result = await processNewCustomer({
            paymentSuccess: true, // Admin-added users are considered paid
            customerData: {
                name: data.name,
                email: data.email,
                mobile: data.mobile.replace(/\D/g, ''),
                address: '', // Not in admin form
                bloodGroup: '', // Not in admin form
                planId: data.planId,
                dietPlanId: data.dietPlanId === 'none' ? null : (data.dietPlanId || null),
                status: 'Active',
                since: format(startDate, "yyyy-MM-dd"),
                isNew: true,
                paymentStatus: 'Paid',
                subscriptionStartDate: startDate.toISOString(),
                subscriptionEndDate: endDate.toISOString(),
                customFields: customFieldValues,
            },
            profileData: {
                name: data.name,
                email: data.email,
                age: data.age.toString(),
                gender: data.gender,
                height: data.height.toString(),
                weight: data.weight.toString(),
                foodPreference: data.foodPreference,
                healthProblems: data.healthProblems || "",
                allergies: data.allergies || ""
            },
            bmiValue: bmiResult?.value,
            bmiMessage: bmiResult?.message
        });

        toast({
          variant: "success",
          title: "Customer Created", 
          description: "Welcome email is being sent in the background." 
        });
        
        router.push("/admin/customers");

    } catch (error: any) {
        console.error("Error creating customer: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not create customer: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

    const renderCustomField = useCallback((field: CustomField) => {
        return (
            <FormField
                key={field.id}
                control={form.control}
                name={field.id as any}
                render={({ field: formField }) => {
                    let inputComponent;
                    switch (field.type) {
                        case 'number':
                            inputComponent = <Input type="number" placeholder={field.placeholder} {...formField} onChange={e => formField.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} />;
                            break;
                        case 'textarea':
                            inputComponent = <Textarea placeholder={field.placeholder} {...formField} />;
                            break;
                        case 'switch':
                            inputComponent = (
                                <div className="flex items-center pt-2">
                                    <Switch checked={formField.value} onCheckedChange={formField.onChange} />
                                </div>
                            );
                            break;
                        case 'date':
                            inputComponent = (
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !formField.value && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formField.value ? format(new Date(formField.value), "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                    mode="single"
                                    selected={formField.value ? new Date(formField.value) : undefined}
                                    onSelect={formField.onChange}
                                    initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
                            );
                            break;
                        default:
                            inputComponent = <Input placeholder={field.placeholder} {...formField} />;
                    }
                    return (
                        <FormItem className={field.type === 'switch' ? "flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm" : ""}>
                             <FormLabel className={field.type === 'switch' ? 'pt-0' : ''}>{field.label}{field.required ? " *" : ""}</FormLabel>
                            <FormControl>{inputComponent}</FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />
        );
    }, [form]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/customers">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Customer</CardTitle>
            <CardDescription>
              Follow the steps to add a new customer to the system.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-8 mx-auto">
            <ol className="flex items-center w-full max-w-lg">
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {currentStep === 0 && (
              <div className="space-y-4 max-w-lg mx-auto">
                <h3 className="text-xl font-semibold text-center mb-4">Personal Details</h3>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
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
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number (WhatsApp) *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+919000000000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {customFields.filter(f => f.stepId === 'personalDetails').map(renderCustomField)}
              </div>
            )}
            {currentStep === 1 && (
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-center md:text-left mb-4">Body Composition</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <FormField
                          control={form.control}
                          name="height"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Height (cm) *</FormLabel>
                              <FormControl>
                              <Input type="number" placeholder="175" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Weight (kg) *</FormLabel>
                              <FormControl>
                              <Input type="number" placeholder="70" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                  </div>
                    {watchedGender === 'female' && (
                        <FormField
                            control={form.control}
                            name="hips"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Hips (cm) *</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="100" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
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
                              <Textarea placeholder="e.g., High blood pressure, Diabetes" {...field} />
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
                          <FormLabel>Allergies (Optional)</FormLabel>
                          <FormControl>
                              <Textarea placeholder="e.g., Peanuts, Gluten" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  {customFields.filter(f => f.stepId === 'bodyMeasurements').map(renderCustomField)}
                </div>
                <div className="pt-12">
                   {bmiResult && (
                      <Card className={cn("transition-all", bmiResult.colorClass)}>
                          <CardHeader>
                              <CardTitle>BMI Result</CardTitle>
                              <CardDescription>Based on the provided height and weight.</CardDescription>
                          </CardHeader>
                          <CardContent className="text-center">
                              <p className="text-5xl font-bold">{bmiResult.value}</p>
                              <p className="text-lg font-semibold mt-2">{bmiResult.message}</p>
                          </CardContent>
                      </Card>
                   )}
                </div>
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-4 max-w-lg mx-auto">
                 <h3 className="text-xl font-semibold text-center mb-4">Assign Subscription and Diet Plan</h3>
                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Plan *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subscription plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dietPlanId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Predefined Diet Plan</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a diet plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value="none">None</SelectItem>
                          {dietPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {customFields.filter(f => f.stepId === 'assignPlan').map(renderCustomField)}
              </div>
            )}
          </form>
        </FormProvider>
      </CardContent>
      <CardFooter>
        <div className="w-full flex justify-between">
          <Button
            variant="outline"
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isSubmitting}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button type="button" onClick={handleNext} disabled={isSubmitting}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Submitting...' : 'Create Customer'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

