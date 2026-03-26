
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, HeartPulse, FileText, IndianRupee, Utensils, CalendarClock, Ruler, BookCopy, MessageSquare, Ban, NotebookText, Camera, Activity, TrendingUp, TrendingDown, Scale, Info, Building, Mail, BrainCircuit, Drumstick, Wheat, Leaf, Flame, Check, X, ChevronsLeft, ChevronsRight, MapPin, Weight } from "lucide-react";
import { format, isToday, isPast, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, addMonths, subMonths, isSameDay } from "date-fns";
import { doc, getDoc, collection, getDocs, Timestamp, query, where, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { resendWelcomeEmail } from "@/ai/flows/resend-welcome-email-flow";
import { calculateBodyFat } from "@/ai/flows/calculate-body-fat-flow";
import { calculateMacros, type MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";


type CustomerData = {
    name: string;
    email: string;
    mobile?: string;
    address?: string;
    status: 'Active' | 'Inactive';
    paymentStatus?: 'Paid' | 'Failed' | 'Pending';
    since: string;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
    planId: string;
    dietPlanId?: string;
    vendorId?: string;
    vendorName?: string;
    customFields?: Record<string, any>;
    activityLevel?: string;
};

type ProfileData = {
    age?: string;
    gender?: 'male' | 'female';
    height?: string;
    weight?: string;
    neck?: number;
    waist?: number;
    hips?: number;
    goal?: 'Weight Loss' | 'Weight Gain';
    photoURL?: string;
    frontImageUrl?: string;
    backImageUrl?: string;
    leftImageUrl?: string;
    rightImageUrl?: string;
    healthProblems?: string;
    allergies?: string;
    foodPreference?: 'veg' | 'non-veg';
    protein?: string;
    carbs?: string;
    fat?: string;
    fibre?: string;
};

type PlanData = {
    name: string;
    price: number;
}

type FoodItem = {
  foodName: string;
  quantity: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
};

type MealOption = {
    foodItems: FoodItem[];
}

type Meal = {
  time: string;
  title: string;
  options: MealOption[];
  foodItems: FoodItem[]; // for self-diet plans
};

type DietPlanData = {
  id: string;
  name: string;
  focus: string;
  meals: Meal[];
};

type SubscriptionHistoryItem = {
    planName: string;
    startDate: Timestamp;
    endDate: Timestamp;
    amount: number;
    status: string;
}

type MeasurementLog = {
    id: string;
    date: Timestamp;
    weight: number;
    chest: number;
    waist: number;
    hips: number;
    [key: string]: any; 
};

type DietPlanHistoryItem = {
    id: string;
    planName: string;
    assignedAt: Timestamp;
    assignedByName: string;
}

type SelfDietLog = {
    id: string;
    date: Timestamp;
    day: string;
    meals: Meal[];
}

type BmiResult = {
  value: string;
  message: string;
  colorClass: string;
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

type DieticianLog = {
    id: string;
    dayName: string;
    createdAt: Timestamp;
    selections: { [mealTime: string]: number };
    notes?: { [mealTime: string]: string };
    imageURLs?: { [mealTime: string]: string };
    skipped?: { [mealTime: string]: { reason: string } };
    isDaySkipped?: { reason: string };
};

type DailyWeightLog = {
    id: string;
    date: Timestamp;
    weight: number;
};


type ActivityLog = {
    id: string;
    activityName: string;
    durationValue: string;
    intensityName: string;
    caloriesBurned: number;
    date: Timestamp;
};

const formatTime12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 'N/A';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

export default function ViewCustomerPage() {
  const [loading, setLoading] = useState(true);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlanData | null>(null);
  const [dietPlanHistory, setDietPlanHistory] = useState<DietPlanHistoryItem[]>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [measurementLogs, setMeasurementLogs] = useState<MeasurementLog[]>([]);
  const [dieticianLogs, setDieticianLogs] = useState<DieticianLog[]>([]);
  const [selfDietLogs, setSelfDietLogs] = useState<SelfDietLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dailyWeightLogs, setDailyWeightLogs] = useState<DailyWeightLog[]>([]);
  const [bodyFatResult, setBodyFatResult] = useState<BodyFatResult | null>(null);
  const [isCalculatingBodyFat, setIsCalculatingBodyFat] = useState(false);
  const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const customerId = params.customerId as string;

  useEffect(() => {
    if (!db || !customerId || !auth?.currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const customerDocRef = doc(db, "customers", customerId);
        const profileDocRef = doc(db, "userProfiles", customerId);
        
        const [customerSnap, profileSnap] = await Promise.all([
          getDoc(customerDocRef),
          getDoc(profileDocRef),
        ]);

        if (customerSnap.exists() && customerSnap.data().assignedStaffId === auth.currentUser?.uid) {
          const customerData = customerSnap.data() as CustomerData;
          setCustomer(customerData);
          
          let profileData: ProfileData | null = null;
          if (profileSnap.exists()) {
            profileData = profileSnap.data() as ProfileData;
            setProfile(profileData);
          }

          if (customerData.planId) {
            const planDocRef = doc(db, "subscriptionPlans", customerData.planId);
            const planSnap = await getDoc(planDocRef);
            if (planSnap.exists()) {
              setPlan(planSnap.data() as PlanData);
            }
          }

          if (customerData.dietPlanId) {
            const dietPlanDocRef = doc(db, "dietPlans", customerData.dietPlanId);
            const dietPlanSnap = await getDoc(dietPlanDocRef);
            if(dietPlanSnap.exists()){
                setDietPlan({ id: dietPlanSnap.id, ...dietPlanSnap.data() } as DietPlanData)
            }
          }
          
           if (profileData?.gender && profileData.height && profileData.neck && profileData.waist) {
              setIsCalculatingBodyFat(true);
              try {
                const bfpResult = await calculateBodyFat({
                  gender: profileData.gender,
                  height: Number(profileData.height),
                  neck: Number(profileData.neck),
                  waist: Number(profileData.waist),
                  ...(profileData.gender === 'female' && { hips: Number(profileData.hips) })
                });
                if(bfpResult.bodyFatPercentage > 0) {
                    let message = "", colorClass = "";
                    if (profileData.gender === 'male') {
                        if (bfpResult.bodyFatPercentage < 6) { message = "Essential Fat"; colorClass = "bg-blue-100"; } else if (bfpResult.bodyFatPercentage < 14) { message = "Athletes"; colorClass = "bg-green-100"; } else if (bfpResult.bodyFatPercentage < 18) { message = "Fitness"; colorClass = "bg-green-100"; } else if (bfpResult.bodyFatPercentage < 25) { message = "Average"; colorClass = "bg-orange-100"; } else { message = "Obese"; colorClass = "bg-red-100"; }
                    } else {
                        if (bfpResult.bodyFatPercentage < 14) { message = "Essential Fat"; colorClass = "bg-blue-100"; } else if (bfpResult.bodyFatPercentage < 21) { message = "Athletes"; colorClass = "bg-green-100"; } else if (bfpResult.bodyFatPercentage < 25) { message = "Fitness"; colorClass = "bg-green-100"; } else if (bfpResult.bodyFatPercentage < 32) { message = "Average"; colorClass = "bg-orange-100"; } else { message = "Obese"; colorClass = "bg-red-100"; }
                    }
                    setBodyFatResult({ value: bfpResult.bodyFatPercentage.toFixed(1), message, colorClass });
                }
              } catch (e) { console.error("Body fat calculation failed:", e); }
              finally { setIsCalculatingBodyFat(false); }
          }


           const dietHistoryQuery = query(collection(db, `customers/${customerId}/dietPlanHistory`), orderBy("assignedAt", "desc"));
           const dietHistorySnap = await getDocs(dietHistoryQuery);
           setDietPlanHistory(dietHistorySnap.docs.map(d => ({...d.data(), id: d.id } as DietPlanHistoryItem)));

          const measurementLogsQuery = query(collection(db, "measurementLogs"), where("userId", "==", customerId), orderBy("date", "asc"));
          const measurementLogsSnap = await getDocs(measurementLogsQuery);
          if(!measurementLogsSnap.empty) {
            const logs = measurementLogsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as MeasurementLog).reverse();
            setMeasurementLogs(logs);
          }
          
           const dieticianLogsQuery = query(collection(db, `users/${customerId}/dieticianPlanLogs`), orderBy("createdAt", "desc"));
            const dieticianLogsSnap = await getDocs(dieticianLogsQuery);
            if (!dieticianLogsSnap.empty) {
                const logs = dieticianLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DieticianLog));
                setDieticianLogs(logs);
            }

            const selfLogsQuery = query(collection(db, `users/${customerId}/selfDietPlans`), orderBy("date", "desc"));
            const selfLogsSnap = await getDocs(selfLogsQuery);
            if (!selfLogsSnap.empty) {
                const logs = selfLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SelfDietLog));
                setSelfDietLogs(logs);
            }
            
            const activityLogsQuery = query(collection(db, `users/${customerId}/activityLogs`), orderBy("date", "desc"));
            const activityLogsSnap = await getDocs(activityLogsQuery);
            if (!activityLogsSnap.empty) {
                const logs = activityLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
                setActivityLogs(logs);
            }
            
            const weightLogsQuery = query(collection(db, `dailyWeightLogs`), where("userId", "==", customerId), orderBy("date", "asc"));
            const weightLogsSnap = await getDocs(weightLogsQuery);
            if (!weightLogsSnap.empty) {
                setDailyWeightLogs(weightLogsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as DailyWeightLog));
            }


        } else {
          toast({ variant: "destructive", title: "Error", description: "Customer not found or not assigned to you." });
          router.push('/staff/my-customers');
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch customer data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, customerId, auth, toast, router]);

  const { bmiResult, bmrResult } = useMemo(() => {
    if (!profile) return { bmiResult: null, bmrResult: null };
    const heightInMeters = Number(profile.height) / 100;
    const weightInKg = Number(profile.weight);
    const ageInYears = Number(profile.age);
    const gender = profile.gender;
    let bmiRes: BmiResult | null = null, bmrRes: BmrResult | null = null;
    if (heightInMeters > 0 && weightInKg > 0) {
      const bmi = weightInKg / (heightInMeters * heightInMeters);
      let message = "", colorClass = "";
      if (bmi < 18.5) { message = "Underweight"; colorClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"; }
      else if (bmi < 25) { message = "Normal Weight"; colorClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"; }
      else if (bmi < 30) { message = "Overweight"; colorClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200"; }
      else { message = "Obesity"; colorClass = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200"; }
      bmiRes = { value: bmi.toFixed(2), message, colorClass };
    }
    if (weightInKg > 0 && heightInMeters > 0 && ageInYears > 0 && gender) {
        let bmr: number;
        if(gender === 'male'){ bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5; }
        else { bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161; }
        bmrRes = { value: bmr.toFixed(0), message: "calories/day" };
    }
    return { bmiResult: bmiRes, bmrResult: bmrRes };
  }, [profile]);
  
    const calculateBmiAndBmrForDay = (weight: number) => {
        if (!profile) return { bmi: null, bmr: null };
        const heightInMeters = Number(profile.height) / 100;
        const weightInKg = weight;
        const ageInYears = Number(profile.age);
        const gender = profile.gender;

        let bmi = null;
        if (heightInMeters > 0 && weightInKg > 0) {
            bmi = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);
        }

        let bmr = null;
        if (weightInKg > 0 && heightInMeters > 0 && ageInYears > 0 && gender) {
            if(gender === 'male'){ bmr = ((10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5).toFixed(0); }
            else { bmr = ((10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161).toFixed(0); }
        }
        return { bmi, bmr };
    };

  const calculateLogTotals = (log: DieticianLog) => {
    let calories = 0, protein = 0, fat = 0, carbs = 0;
    if (!dietPlan || !log.selections || log.isDaySkipped) return { calories, protein, fat, carbs };

    dietPlan.meals.forEach(meal => {
      if (log.skipped?.[meal.time]) return;
      const selectionIndex = log.selections[meal.time];
      if (selectionIndex !== undefined) {
        const selectedOption = meal.options[selectionIndex];
        if (selectedOption) {
          selectedOption.foodItems.forEach(item => {
            calories += item.calories || 0;
            protein += item.protein || 0;
            fat += item.fat || 0;
            carbs += item.carbs || 0;
          });
        }
      }
    });
    return { 
        calories: calories.toFixed(0), 
        protein: protein.toFixed(1), 
        fat: fat.toFixed(1), 
        carbs: carbs.toFixed(1) 
    };
  };

  const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base">{value || 'N/A'}</p>
        </div>
    </div>
  );

  const bodyImages = [
      profile?.frontImageUrl,
      profile?.backImageUrl,
      profile?.leftImageUrl,
      profile?.rightImageUrl
  ].filter(Boolean) as string[];

  const dieticianLogMap = useMemo(() => {
    return dieticianLogs.reduce((acc, log) => {
        const dateKey = format(log.createdAt.toDate(), 'yyyy-MM-dd');
        acc[dateKey] = log;
        return acc;
    }, {} as {[key: string]: DieticianLog});
  }, [dieticianLogs]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        setSelectedLogDate(date);
        setIsLogDialogOpen(true);
    }
  }
  
  const selectedLogData = useMemo(() => selectedLogDate ? dieticianLogMap[format(selectedLogDate, 'yyyy-MM-dd')] : null, [selectedLogDate, dieticianLogMap]);
  const selectedLogDayWeightLog = useMemo(() => selectedLogDate ? dailyWeightLogs.find(wl => format(wl.date.toDate(), 'yyyy-MM-dd') === format(selectedLogDate, 'yyyy-MM-dd')) : null, [selectedLogDate, dailyWeightLogs]);
  const selectedLogDayActivityLog = useMemo(() => selectedLogDate ? activityLogs.find(al => format(al.date.toDate(), 'yyyy-MM-dd') === format(selectedLogDate, 'yyyy-MM-dd')) : null, [selectedLogDate, activityLogs]);
  const selectedLogDayStats = useMemo(() => selectedLogDayWeightLog ? calculateBmiAndBmrForDay(selectedLogDayWeightLog.weight) : { bmi: null, bmr: null }, [selectedLogDayWeightLog, profile, calculateBmiAndBmrForDay]);


  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!customer) {
    return <p>No customer data to display.</p>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/staff/my-customers">
                <Button variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.photoURL} />
                  <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{customer.name}</CardTitle>
                <CardDescription>{customer.email}</CardDescription>
                {customer.vendorName && (
                  <Badge variant="outline" className="mt-2">
                    <Building className="mr-2 h-3 w-3" />
                    Added by: {customer.vendorName}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
                  <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                  <Badge variant={customer.paymentStatus === 'Paid' ? 'success' : customer.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                      {customer.paymentStatus || 'N/A'}
                  </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
             <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview"><User className="mr-2 h-4 w-4" />Overview</TabsTrigger>
                    <TabsTrigger value="monthly-progress"><Ruler className="mr-2 h-4 w-4"/>Monthly Progress</TabsTrigger>
                    <TabsTrigger value="logs"><BookCopy className="mr-2 h-4 w-4" />Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Personal Information</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 gap-6">
                                <DetailItem icon={Mail} label="Mobile Number" value={customer.mobile} />
                                <DetailItem icon={CalendarClock} label="Member Since" value={customer.since} />
                                <div className="col-span-2">
                                <DetailItem icon={MapPin} label="Address" value={customer.address} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><HeartPulse className="h-5 w-5"/> Health Profile</CardTitle></CardHeader>
                             <CardContent className="grid grid-cols-2 gap-6">
                                <DetailItem icon={Info} label="Age" value={profile?.age} />
                                <DetailItem icon={Info} label="Gender" value={profile?.gender} />
                                <DetailItem icon={Ruler} label="Height" value={`${profile?.height || 'N/A'} cm`} />
                                <DetailItem icon={Weight} label="Weight" value={`${profile?.weight || 'N/A'} kg`} />
                                {customer.activityLevel && <DetailItem icon={Flame} label="Calorie Goal" value={`${parseFloat(customer.activityLevel).toFixed(0)} kcal/day`} />}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><BrainCircuit className="h-5 w-5" /> Health &amp; Nutrition Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card className={cn("transition-all", bmiResult?.colorClass)}>
                                <CardHeader><CardTitle>BMI</CardTitle><CardDescription>Body Mass Index</CardDescription></CardHeader>
                                <CardContent className="text-center"><p className="text-3xl font-bold">{bmiResult?.value || 'N/A'}</p><p className="text-md font-semibold mt-1">{bmiResult?.message}</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>BMR</CardTitle><CardDescription>Basal Metabolic Rate</CardDescription></CardHeader>
                                <CardContent className="text-center"><p className="text-3xl font-bold">{bmrResult?.value || 'N/A'}</p><p className="text-md font-semibold mt-1 text-muted-foreground">{bmrResult?.message}</p></CardContent>
                            </Card>
                             <Card className={cn("transition-all", bodyFatResult?.colorClass)}>
                                <CardHeader><CardTitle>Body Fat %</CardTitle><CardDescription>Estimated</CardDescription></CardHeader>
                                <CardContent className="text-center">{isCalculatingBodyFat ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : bodyFatResult ? <><p className="text-3xl font-bold">{bodyFatResult.value}%</p><p className="text-md font-semibold mt-1">{bodyFatResult.message}</p></> : <p className="text-sm text-muted-foreground">Not enough data</p>}</CardContent>
                            </Card>
                        </CardContent>
                    </Card>

                     <Card className="bg-amber-50 dark:bg-amber-900/20">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Utensils className="h-5 w-5"/> Daily Nutrient Needs</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <DetailItem icon={Drumstick} label="Protein" value={profile?.protein ? `${profile.protein}g` : 'N/A'} />
                           <DetailItem icon={Wheat} label="Carbs" value={profile?.carbs ? `${profile.carbs}g` : 'N/A'} />
                           <DetailItem icon={Flame} label="Fat" value={profile?.fat ? `${profile.fat}g` : 'N/A'} />
                           <DetailItem icon={Leaf} label="Fibre" value={profile?.fibre ? `${profile.fibre}g` : 'N/A'} />
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><IndianRupee className="h-5 w-5"/> Current Subscription</CardTitle></CardHeader>
                        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <DetailItem icon={Info} label="Plan Name" value={plan?.name} />
                            <DetailItem icon={Info} label="Plan Price" value={`₹${plan?.price || 0}`} />
                            <DetailItem icon={CalendarClock} label="Start Date" value={customer.subscriptionStartDate ? format(customer.subscriptionStartDate.toDate(), 'PPP') : 'N/A'} />
                            <DetailItem icon={CalendarClock} label="End Date" value={customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'} />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-5 w-5"/> Body Images</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {bodyImages.map((img, index) => (
                                <div key={index} className="border rounded-md overflow-hidden">
                                    <Image src={img} alt={`Body image ${index+1}`} width={200} height={300} className="w-full object-cover aspect-[2/3]"/>
                                </div>
                            ))}
                            {bodyImages.length === 0 && <div className="col-span-4 text-muted-foreground text-center p-8 border rounded-md">No body images uploaded.</div>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Utensils className="h-5 w-5" /> Diet Plan History</CardTitle></CardHeader>
                        <CardContent>
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Plan Name</TableHead>
                                       <TableHead>Assigned On</TableHead>
                                       <TableHead>Assigned By</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {dietPlanHistory.length > 0 ? dietPlanHistory.map((item) => (
                                       <TableRow key={item.id}>
                                           <TableCell>{item.planName}</TableCell>
                                           <TableCell>{format(item.assignedAt.toDate(), 'PPP')}</TableCell>
                                           <TableCell>{item.assignedByName}</TableCell>
                                       </TableRow>
                                   )) : (
                                       <TableRow>
                                           <TableCell colSpan={3} className="text-center">No diet plan assignment history.</TableCell>
                                       </TableRow>
                                   )}
                               </TableBody>
                           </Table>
                        </CardContent>
                    </Card>

                    {customer.customFields && Object.keys(customer.customFields).length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5"/> Additional Information</CardTitle></CardHeader>
                            <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.entries(customer.customFields).map(([key, value]) => (
                                    <DetailItem key={key} icon={Info} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={value.toString()} />
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                
                <TabsContent value="monthly-progress" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg">Monthly Progress</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Weight (kg)</TableHead>
                                        <TableHead>Chest (in)</TableHead>
                                        <TableHead>Waist (in)</TableHead>
                                        <TableHead>Hips (in)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {measurementLogs.length > 0 ? measurementLogs.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{format(item.date.toDate(), 'PPP')}</TableCell>
                                            <TableCell>{item.weight}</TableCell>
                                            <TableCell>{item.chest}</TableCell>
                                            <TableCell>{item.waist}</TableCell>
                                            <TableCell>{item.hips}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center">No measurements logged.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="logs" className="mt-6">
                     <Card>
                         <CardHeader>
                            <CardTitle>Log Calendar</CardTitle>
                            <CardDescription>Select a date to view details.</CardDescription>
                         </CardHeader>
                         <CardContent className="flex justify-center">
                             <Calendar
                                month={currentMonth}
                                onMonthChange={setCurrentMonth}
                                selected={selectedLogDate || undefined}
                                onDayClick={handleDateSelect}
                                className="p-0"
                                components={{
                                    DayContent: ({ date }) => {
                                        const dateKey = format(date, 'yyyy-MM-dd');
                                        const logForDay = dieticianLogMap[dateKey];
                                        const isLogged = !!logForDay;
                                        const isMissed = isPast(date) && !isToday(date) && !isLogged;
                                        
                                        return (
                                            <div className={cn(
                                                "relative w-full h-full flex items-center justify-center rounded-md",
                                                isLogged && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
                                                isMissed && "bg-red-100 text-red-800 dark:bg-red-800/50 dark:text-red-200",
                                                isToday(date) && "bg-accent/20",
                                                !isPast(date) && !isToday(date) ? "hover:bg-accent/50 border border-transparent hover:border-primary" : ""
                                            )}>
                                            <span>{format(date, 'd')}</span>
                                            {isLogged && <Check className="absolute bottom-1 right-1 h-3 w-3 text-green-600" />}
                                            {isMissed && <X className="absolute bottom-1 right-1 h-3 w-3 text-red-600" />}
                                            </div>
                                        );
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Log for {selectedLogDate ? format(selectedLogDate, 'PPP') : ''}</DialogTitle>
            </DialogHeader>
            {selectedLogData ? (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted p-3 rounded-md border">
                        <DetailItem icon={Scale} label="Weight" value={selectedLogDayWeightLog ? `${selectedLogDayWeightLog.weight} kg` : "N/A"} />
                        <DetailItem icon={Info} label="BMI" value={selectedLogDayStats.bmi || "N/A"} />
                        <DetailItem icon={Info} label="BMR" value={selectedLogDayStats.bmr ? `${selectedLogDayStats.bmr} kcal` : "N/A"} />
                        {selectedLogDayActivityLog && <DetailItem icon={Activity} label="Activity" value={`${selectedLogDayActivityLog.activityName} (${selectedLogDayActivityLog.caloriesBurned.toFixed(0)} kcal)`} />}
                    </div>
                    {selectedLogData.isDaySkipped ? (
                        <p className="text-destructive text-sm font-medium p-4">Day Skipped: {selectedLogData.isDaySkipped.reason}</p>
                    ) : (
                        <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground mb-4 border-b pb-4">
                            <span><b>Calories:</b> {calculateLogTotals(selectedLogData).calories}</span>
                            <span><b>Protein:</b> {calculateLogTotals(selectedLogData).protein}g</span>
                            <span><b>Fat:</b> {calculateLogTotals(selectedLogData).fat}g</span>
                            <span><b>Carbs:</b> {calculateLogTotals(selectedLogData).carbs}g</span>
                        </div>
                        <Accordion type="multiple" defaultValue={dietPlan?.meals?.map(m => m.time) || []} className="w-full">
                            {dietPlan?.meals?.map((meal) => {
                                const selectionIndex = selectedLogData.selections?.[meal.time];
                                if (selectionIndex === undefined || selectedLogData.skipped?.[meal.time]) return null;
                                const selectedOption = meal.options[selectionIndex];
                                if (!selectedOption) return null;
                                return (
                                    <AccordionItem value={meal.time} key={meal.time}>
                                        <AccordionTrigger>{meal.title} - Option {selectionIndex + 1}</AccordionTrigger>
                                        <AccordionContent>
                                            <ul className="list-disc pl-5 mt-1 text-sm">
                                                {selectedOption.foodItems.map((item, idx) => <li key={idx}>{item.foodName} ({item.quantity})</li>)}
                                            </ul>
                                            {selectedLogData?.notes?.[meal.time] && <p className="mt-2 text-xs italic">Note: {selectedLogData.notes[meal.time]}</p>}
                                            {selectedLogData?.imageURLs?.[meal.time] && <a href={selectedLogData.imageURLs[meal.time]} target="_blank" rel="noopener noreferrer"><Image src={selectedLogData.imageURLs[meal.time]} alt="Meal" width={80} height={80} className="mt-2 rounded-md" /></a>}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                        </>
                    )}
                </div>
            ) : (
                <div className="text-center text-muted-foreground p-8">
                    No log was recorded for this day.
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


