
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/components/firebase-provider';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Utensils, Weight, Flame, Info, Target } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type Customer = {
    id: string;
    name: string;
    planId: string;
    dietPlanId?: string;
    subscriptionEndDate?: Timestamp;
};

type ProfileData = {
    age?: string;
    gender?: string;
    height?: string;
}

type Plan = {
    id: string;
    name: string;
};

type DailyWeightLog = {
    id: string;
    date: Timestamp;
    weight: number;
};

type FoodItem = {
    calories?: number;
};

type Meal = {
    foodItems: FoodItem[];
    options?: { foodItems: FoodItem[] }[];
};

type DietLog = {
    selections?: { [mealTime: string]: number };
    meals?: Meal[]; // For self-diet
    isDaySkipped?: boolean;
    skipped?: { [key: string]: any };
};

type DietPlan = {
    meals?: Meal[];
}

export default function CustomerDashboard() {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [assignedPlan, setAssignedPlan] = useState<DietPlan | null>(null);
    const [latestWeightLog, setLatestWeightLog] = useState<DailyWeightLog | null>(null);
    const [todaysCalorieIntake, setTodaysCalorieIntake] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    const customerDocRef = doc(db, 'customers', user.uid);
                    const profileDocRef = doc(db, 'userProfiles', user.uid);
                    
                    const [customerSnap, profileSnap] = await Promise.all([
                        getDoc(customerDocRef).catch(err => { throw new FirestorePermissionError({ path: customerDocRef.path, operation: 'get' })}),
                        getDoc(profileDocRef).catch(err => { throw new FirestorePermissionError({ path: profileDocRef.path, operation: 'get' })})
                    ]);
                    
                    if (customerSnap.exists()) {
                        const customerData = { id: customerSnap.id, ...customerSnap.data() } as Customer;
                        setCustomer(customerData);
                        
                        if (profileSnap.exists()) {
                            setProfile(profileSnap.data() as ProfileData);
                        }

                        // Fetch related data
                        const planDocRef = doc(db, 'subscriptionPlans', customerData.planId);
                        const weightQuery = query(
                            collection(db, "dailyWeightLogs"),
                            where("userId", "==", user.uid),
                            orderBy("date", "desc"),
                            limit(1)
                        );
                        
                        let assignedPlanSnap = null;
                        if (customerData.dietPlanId) {
                            assignedPlanSnap = await getDoc(doc(db, "dietPlans", customerData.dietPlanId)).catch(err => { throw new FirestorePermissionError({ path: `dietPlans/${customerData.dietPlanId}`, operation: 'get' })});
                            if(assignedPlanSnap.exists()) {
                                setAssignedPlan(assignedPlanSnap.data() as DietPlan);
                            }
                        }

                        const [planSnap, weightSnap] = await Promise.all([
                            getDoc(planDocRef).catch(err => { throw new FirestorePermissionError({ path: planDocRef.path, operation: 'get' })}),
                            getDocs(weightQuery).catch(err => { throw new FirestorePermissionError({ path: `dailyWeightLogs where userId == ${user.uid}`, operation: 'list' })})
                        ]);

                        if (planSnap.exists()) {
                            setPlan({ id: planSnap.id, ...planSnap.data() } as Plan);
                        }
                        
                        if (!weightSnap.empty) {
                            setLatestWeightLog({ id: weightSnap.docs[0].id, ...weightSnap.docs[0].data() } as DailyWeightLog);
                        }
                        
                        // Fetch today's logs for calorie calculation
                        const todayKey = format(new Date(), 'yyyy-MM-dd');
                        const dieticianLogRef = doc(db, `users/${user.uid}/dieticianPlanLogs`, todayKey);
                        const selfLogRef = doc(db, `users/${user.uid}/selfDietPlans`, todayKey);
                        
                        const [dieticianLogSnap, selfLogSnap] = await Promise.all([
                            getDoc(dieticianLogRef).catch(err => { throw new FirestorePermissionError({ path: dieticianLogRef.path, operation: 'get' })}),
                            getDoc(selfLogRef).catch(err => { throw new FirestorePermissionError({ path: selfLogRef.path, operation: 'get' })})
                        ]);

                        let calories = 0;
                        if (dieticianLogSnap.exists()) {
                            const logData = dieticianLogSnap.data() as DietLog;
                             if (!logData.isDaySkipped && assignedPlanSnap?.exists()) {
                                const planData = assignedPlanSnap.data() as DietPlan;
                                planData.meals?.forEach(meal => {
                                    if(logData.skipped?.[meal.time]) return;
                                    const selectedOptionIndex = logData.selections?.[meal.time];
                                    if(selectedOptionIndex !== undefined) {
                                        meal.options?.[selectedOptionIndex]?.foodItems.forEach(item => {
                                            calories += item.calories || 0;
                                        });
                                    }
                                });
                            }
                        } else if (selfLogSnap.exists()) {
                            const logData = selfLogSnap.data() as DietLog;
                            logData.meals?.forEach(meal => {
                                meal.foodItems.forEach(item => {
                                    calories += item.calories || 0;
                                })
                            })
                        }
                         setTodaysCalorieIntake(calories);
                    }
                } catch (error: any) {
                    if (error instanceof FirestorePermissionError) {
                        errorEmitter.emit('permission-error', error);
                    } else {
                        console.error("Error fetching dashboard data:", error);
                    }
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [auth, db]);

    const { bmi, bmr, weightGoal } = useMemo(() => {
        if (!latestWeightLog || !profile?.height || !profile?.age || !profile?.gender) {
            return { bmi: null, bmr: null, weightGoal: null };
        }
        const heightInMeters = Number(profile.height) / 100;
        const weightInKg = Number(latestWeightLog.weight);
        const ageInYears = Number(profile.age);
        const gender = profile.gender;

        const bmiValue = (weightInKg / (heightInMeters * heightInMeters));
        
        let suggestion = null;
        if(heightInMeters > 0 && weightInKg > 0) {
            const targetWeight = 22 * (heightInMeters * heightInMeters);
            const weightDiff = weightInKg - targetWeight;
            if (bmiValue < 18.5) { 
              suggestion = `You have to Gain ${Math.abs(weightDiff).toFixed(1)} kg to be fit`;
            } else if (bmiValue >= 25) {
              suggestion = `You have to Reduce ${weightDiff.toFixed(1)} kg to be fit`;
            }
        }


        let bmrValue = 0;
        if (gender === 'male') {
            bmrValue = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5;
        } else {
            bmrValue = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161;
        }

        return { bmi: bmiValue.toFixed(1), bmr: bmrValue.toFixed(0), weightGoal: suggestion };
    }, [latestWeightLog, profile]);


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {loading ? (
                    <Skeleton className="h-8 w-1/2" />
                ) : (
                    <h1 className="text-3xl font-bold">Welcome back, {customer?.name || 'User'}!</h1>
                )}
                {weightGoal && (
                     <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                        <CardContent className="p-3 flex items-center gap-3">
                           <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full">
                                <Target className="h-6 w-6 text-green-600 dark:text-green-300" />
                            </div>
                           <p className="text-sm font-semibold text-green-800 dark:text-green-200">{weightGoal}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Calorie Intake</CardTitle>
                        <Flame className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{todaysCalorieIntake} kcal</div>}
                        <p className="text-xs text-muted-foreground">Based on meals logged today</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Latest BMI</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{bmi || "N/A"}</div>}
                        <p className="text-xs text-muted-foreground">Body Mass Index</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Latest BMR</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{bmr ? `${bmr} kcal` : "N/A"}</div>}
                        <p className="text-xs text-muted-foreground">Basal Metabolic Rate</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <Calendar className="h-5 w-5 text-primary" />
                           My Plan
                        </CardTitle>
                        <CardDescription>Your current subscription details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <>
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </>
                        ) : plan && customer?.subscriptionEndDate ? (
                           <div>
                                <p className="font-semibold text-lg">{plan.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Expires on: {format(customer.subscriptionEndDate.toDate(), 'PPP')}
                                </p>
                           </div>
                        ) : (
                            <p className="text-muted-foreground">No active plan found.</p>
                        )}
                         <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/subscription">
                                Manage Subscription <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                           <Utensils className="h-5 w-5 text-primary" />
                           Today's Diet
                        </CardTitle>
                        <CardDescription>View your diet plan for today.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                             <Skeleton className="h-6 w-3/4" />
                        ) : (
                            <p className="font-semibold text-lg">Ready to Log?</p>
                        )}
                        <p className="text-sm text-muted-foreground">Track your meals to stay on target.</p>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/dietician-diet-plan">
                                View Diet Plan <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                           <Weight className="h-5 w-5 text-primary" />
                           Latest Weight
                        </CardTitle>
                        <CardDescription>Your most recently logged weight.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {loading ? (
                             <Skeleton className="h-6 w-3/4" />
                        ) : latestWeightLog ? (
                             <div>
                                <p className="font-semibold text-lg">{latestWeightLog.weight} kg</p>
                                <p className="text-sm text-muted-foreground">
                                    Logged on: {format(latestWeightLog.date.toDate(), 'PPP')}
                                </p>
                           </div>
                        ) : (
                             <p className="text-muted-foreground">No weight logged yet.</p>
                        )}
                         <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/daily-weight-tracking">
                                Track Weight <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
