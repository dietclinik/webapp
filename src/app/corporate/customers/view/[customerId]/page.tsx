

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, User, HeartPulse, FileText, IndianRupee, Utensils, BookCopy, MessageSquare, Ruler, Ban, NotebookText, Camera, Activity, TrendingUp, TrendingDown, Scale, Info, Building, Weight } from "lucide-react";
import { format, isToday, isPast, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, addMonths, subMonths, isSameDay } from "date-fns";
import { doc, getDoc, collection, getDocs, Timestamp, query, where, updateDoc, orderBy, serverTimestamp, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { onAuthStateChanged } from "firebase/auth";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

type CustomerData = {
    name: string;
    email: string;
    mobile?: string;
    address?: string;
    status: 'Active' | 'Inactive';
    subscriptionEndDate?: Timestamp;
    planId?: string;
    planName?: string;
    dietPlanId?: string;
    activityLevel?: string;
    corporateId?: string;
};

type ProfileData = {
    age?: string;
    gender?: string;
    height?: string;
    weight?: string;
    goal?: 'Weight Loss' | 'Weight Gain';
    photoURL?: string;
    frontImageUrl?: string;
    backImageUrl?: string;
    leftImageUrl?: string;
    rightImageUrl?: string;
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

type DieticianLog = {
    id: string;
    dayName: string;
    createdAt: Timestamp;
    selections: { [mealTime: string]: number };
    notes: { [mealTime: string]: string };
    imageURLs: { [mealTime: string]: string };
    skipped?: { [mealTime: string]: { reason: string } };
    isDaySkipped?: { reason: string };
}

type MeasurementLog = {
    id: string;
    date: Timestamp;
    weight: number;
    chest: number;
    waist: number;
    hips: number;
};

type SelfDietLog = {
    id: string;
    date: Timestamp;
    day: string;
    meals: Meal[];
}

type ActivityLog = {
    id: string;
    activityName: string;
    durationValue: string;
    intensityName: string;
    caloriesBurned: number;
    date: Timestamp;
};

type DailyWeightLog = {
    id: string;
    date: Timestamp;
    weight: number;
};

const formatTime12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 'N/A';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

const DetailItem = ({ icon: Icon, label, value }: { icon?: React.ElementType, label: string, value?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground mt-1" />}
        <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base">{value || 'N/A'}</p>
        </div>
    </div>
);

export default function CorporateViewCustomerPage() {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlanData | null>(null);
  const [dieticianLogs, setDieticianLogs] = useState<DieticianLog[]>([]);
  const [measurementLogs, setMeasurementLogs] = useState<MeasurementLog[]>([]);
  const [selfDietLogs, setSelfDietLogs] = useState<SelfDietLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dailyWeightLogs, setDailyWeightLogs] = useState<DailyWeightLog[]>([]);
  const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const customerId = params.customerId as string;

  useEffect(() => {
    if (!db || !customerId || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            router.push('/corporate/login');
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const customerDocRef = doc(db, "customers", customerId);
                const customerSnap = await getDoc(customerDocRef);
                if (!customerSnap.exists() || customerSnap.data().corporateId !== user.uid) {
                     toast({ variant: "destructive", title: "Error", description: "Customer not found or you don't have permission to view." });
                     router.push('/corporate/customers');
                     return;
                }
                const customerData = customerSnap.data() as CustomerData;
                if (customerData.planId) {
                    const planDocRef = doc(db, "subscriptionPlans", customerData.planId);
                    const planSnap = await getDoc(planDocRef);
                    if(planSnap.exists()){
                        customerData.planName = planSnap.data().name;
                    }
                }
                setCustomer(customerData);

                const profileDocRef = doc(db, "userProfiles", customerId);
                const profileSnap = await getDoc(profileDocRef);
                if (profileSnap.exists()) {
                    setProfile(profileSnap.data() as ProfileData);
                }
                
                if(customerData.dietPlanId) {
                    const assignedPlanDoc = await getDoc(doc(db, "dietPlans", customerData.dietPlanId));
                    if(assignedPlanDoc.exists()){
                        setDietPlan({ id: assignedPlanDoc.id, ...assignedPlanDoc.data()} as DietPlanData);
                    }
                }

                const dieticianLogsQuery = query(collection(db, `users/${customerId}/dieticianPlanLogs`), orderBy("createdAt", "desc"));
                const measurementLogsQuery = query(collection(db, "measurementLogs"), where("userId", "==", customerId), orderBy("date", "desc"));
                const selfLogsQuery = query(collection(db, `users/${customerId}/selfDietPlans`), orderBy("date", "desc"));
                const activityLogsQuery = query(collection(db, `users/${customerId}/activityLogs`), orderBy("date", "desc"));
                const weightLogsQuery = query(collection(db, `dailyWeightLogs`), where("userId", "==", customerId), orderBy("date", "asc"));
                
                const [dieticianLogsSnap, measurementLogsSnap, selfLogsSnap, activityLogsSnap, weightLogsSnap] = await Promise.all([
                    getDocs(dieticianLogsQuery),
                    getDocs(measurementLogsQuery),
                    getDocs(selfLogsQuery),
                    getDocs(activityLogsQuery),
                    getDocs(weightLogsQuery),
                ]);
                
                setDieticianLogs(dieticianLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DieticianLog)));
                setMeasurementLogs(measurementLogsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as MeasurementLog));
                setSelfDietLogs(selfLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SelfDietLog)));
                setActivityLogs(activityLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
                setDailyWeightLogs(weightLogsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as DailyWeightLog));

            } catch (error: any) {
                const permissionError = new FirestorePermissionError({
                    path: `customers/${customerId} or related subcollection`,
                    operation: 'get'
                });
                errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    });

    return () => unsubscribe();
  }, [db, customerId, auth, toast, router]);

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

        dietPlan.meals?.forEach(meal => {
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

    const calculateSelfLogTotals = (log: SelfDietLog) => {
        let calories = 0, protein = 0, fat = 0, carbs = 0;
        if (!log || !log.meals) return { calories, protein, fat, carbs };

        log.meals.forEach(meal => {
            meal.foodItems.forEach(item => {
                calories += item.calories || 0;
                protein += item.protein || 0;
                fat += item.fat || 0;
                carbs += item.carbs || 0;
            });
        });
        return { 
            calories: calories.toFixed(0), 
            protein: protein.toFixed(1), 
            fat: fat.toFixed(1), 
            carbs: carbs.toFixed(1) 
        };
    };

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
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/corporate/customers">
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
                        </div>
                    </div>
                     <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-3">
                         <TabsTrigger value="overview"><User className="mr-2 h-4 w-4"/>Overview</TabsTrigger>
                         <TabsTrigger value="monthly-progress"><Ruler className="mr-2 h-4 w-4"/>Monthly Progress</TabsTrigger>
                         <TabsTrigger value="logs"><BookCopy className="mr-2 h-4 w-4" />Logs</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6 space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5"/> Personal & Health</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 gap-y-6 gap-x-4">
                                    <DetailItem label="Mobile Number" value={customer.mobile} />
                                    <DetailItem label="Age" value={profile?.age} />
                                    <DetailItem label="Gender" value={profile?.gender} />
                                    <DetailItem label="Height" value={`${profile?.height || 'N/A'} cm`} />
                                    <DetailItem label="Weight" value={`${profile?.weight || 'N/A'} kg`} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><IndianRupee className="h-5 w-5"/> Subscription</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 gap-y-6">
                                     <DetailItem label="Plan" value={customer.planName} />
                                     <DetailItem label="Subscription End" value={customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'} />
                                </CardContent>
                            </Card>
                        </div>
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
                                            <TableRow key={index}>
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
                                                    isLogged && "bg-green-100 dark:bg-green-900/50",
                                                    isMissed && "bg-red-100 dark:bg-red-800/50",
                                                    !isPast(date) && "hover:bg-accent/50 border border-transparent hover:border-primary"
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
