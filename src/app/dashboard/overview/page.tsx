
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/components/firebase-provider';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, Utensils, Weight, Flame, Info, Target, Activity, TrendingUp, TrendingDown, Scale, CheckCircle, AlertTriangle, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { format, startOfDay, endOfDay } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { cn } from '@/lib/utils';

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
    goal?: string;
};

type Plan = { id: string; name: string };

type DailyWeightLog = { id: string; date: Timestamp; weight: number };

export default function CustomerDashboard() {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [latestWeightLog, setLatestWeightLog] = useState<DailyWeightLog | null>(null);
    const [todaysCalorieIntake, setTodaysCalorieIntake] = useState<number>(0);
    const [todaysCaloriesBurned, setTodaysCaloriesBurned] = useState<number>(0);
    const [calorieSource, setCalorieSource] = useState<'dietician' | 'self' | 'none'>('none');
    const [todayWeightLog, setTodayWeightLog] = useState<{ weight: number } | null>(null);
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
                        getDoc(customerDocRef).catch(() => { throw new FirestorePermissionError({ path: customerDocRef.path, operation: 'get' }); }),
                        getDoc(profileDocRef).catch(() => { throw new FirestorePermissionError({ path: profileDocRef.path, operation: 'get' }); }),
                    ]);

                    if (!customerSnap.exists()) return;

                    const customerData = { id: customerSnap.id, ...customerSnap.data() } as Customer;
                    setCustomer(customerData);
                    if (profileSnap.exists()) setProfile(profileSnap.data() as ProfileData);

                    const today = new Date();
                    const dayStart = Timestamp.fromDate(startOfDay(today));
                    const dayEnd = Timestamp.fromDate(endOfDay(today));
                    const todayKey = format(today, 'yyyy-MM-dd');

                    const [planSnap, latestWeightSnap, todayWeightSnap, todayActivitySnap] = await Promise.all([
                        getDoc(doc(db, 'subscriptionPlans', customerData.planId)).catch(() => null),
                        getDocs(query(collection(db, 'dailyWeightLogs'), where('userId', '==', user.uid), orderBy('date', 'desc'), limit(1))).catch(() => null),
                        getDocs(query(collection(db, 'dailyWeightLogs'), where('userId', '==', user.uid), where('date', '>=', dayStart), where('date', '<=', dayEnd))).catch(() => null),
                        getDocs(query(collection(db, `users/${user.uid}/activityLogs`), where('date', '>=', dayStart), where('date', '<=', dayEnd))).catch(() => null),
                    ]);

                    if (planSnap?.exists()) setPlan({ id: planSnap.id, ...planSnap.data() } as Plan);
                    if (latestWeightSnap && !latestWeightSnap.empty) {
                        setLatestWeightLog({ id: latestWeightSnap.docs[0].id, ...latestWeightSnap.docs[0].data() } as DailyWeightLog);
                    }
                    if (todayWeightSnap && !todayWeightSnap.empty) {
                        setTodayWeightLog({ weight: todayWeightSnap.docs[0].data().weight });
                    }

                    let burned = 0;
                    todayActivitySnap?.forEach(d => { burned += d.data().caloriesBurned || 0; });
                    setTodaysCaloriesBurned(Math.round(burned));

                    // Calorie intake: dietician first, then self-diet
                    let calories = 0;
                    let src: 'dietician' | 'self' | 'none' = 'none';

                    if (customerData.dietPlanId) {
                        const [dietLogSnap, dietPlanSnap] = await Promise.all([
                            getDoc(doc(db, `users/${user.uid}/dieticianPlanLogs`, todayKey)).catch(() => null),
                            getDoc(doc(db, 'dietPlans', customerData.dietPlanId)).catch(() => null),
                        ]);
                        if (dietLogSnap?.exists() && dietPlanSnap?.exists()) {
                            const logData = dietLogSnap.data()!;
                            const planData = dietPlanSnap.data()!;
                            if (!logData.isDaySkipped) {
                                planData.meals?.forEach((meal: any) => {
                                    if (logData.skipped?.[meal.time]) return;
                                    const idxs: number[] = logData.selections?.[meal.time] || [];
                                    idxs.forEach((idx: number) => { calories += meal.foodItems?.[idx]?.calories || 0; });
                                });
                                if (calories > 0) src = 'dietician';
                            }
                        }
                    }

                    if (calories === 0) {
                        const selfSnap = await getDocs(query(
                            collection(db, `users/${user.uid}/selfDietPlans`),
                            where('date', '>=', dayStart),
                            where('date', '<=', dayEnd)
                        )).catch(() => null);
                        selfSnap?.forEach(d => {
                            d.data().meals?.forEach((meal: any) => {
                                meal.foodItems?.forEach((item: any) => { calories += item.calories || 0; });
                            });
                        });
                        if (calories > 0) src = 'self';
                    }

                    setTodaysCalorieIntake(Math.round(calories));
                    setCalorieSource(src);
                } catch (error: any) {
                    if (error instanceof FirestorePermissionError) {
                        errorEmitter.emit('permission-error', error);
                    } else {
                        console.error('Error fetching dashboard data:', error);
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

    // BMI / BMR based on today's logged weight (or latest if none today)
    const weightForCalc = todayWeightLog ?? (latestWeightLog ? { weight: latestWeightLog.weight } : null);

    const { bmi, bmiCategory, bmiColor, bmr, netCalories, weightGoalText } = useMemo(() => {
        if (!weightForCalc || !profile?.height || !profile?.age || !profile?.gender) {
            return { bmi: null, bmiCategory: null, bmiColor: '', bmr: null, netCalories: null, weightGoalText: null };
        }
        const w = Number(weightForCalc.weight);
        const hM = Number(profile.height) / 100;
        const age = Number(profile.age);

        const bmiVal = w / (hM * hM);
        let cat = 'Normal', color = 'text-green-600';
        if (bmiVal < 18.5) { cat = 'Underweight'; color = 'text-blue-600'; }
        else if (bmiVal < 25) { cat = 'Normal'; color = 'text-green-600'; }
        else if (bmiVal < 30) { cat = 'Overweight'; color = 'text-orange-500'; }
        else { cat = 'Obese'; color = 'text-red-600'; }

        const targetWeight = 22 * (hM * hM);
        const diff = w - targetWeight;
        const goalText = bmiVal < 18.5
            ? `Gain ${Math.abs(diff).toFixed(1)} kg to reach healthy weight`
            : bmiVal >= 25
            ? `Reduce ${diff.toFixed(1)} kg to reach healthy weight`
            : null;

        const bmrVal = profile.gender === 'male'
            ? 10 * w + 6.25 * (hM * 100) - 5 * age + 5
            : 10 * w + 6.25 * (hM * 100) - 5 * age - 161;

        return {
            bmi: bmiVal.toFixed(1),
            bmiCategory: cat,
            bmiColor: color,
            bmr: Math.round(bmrVal),
            netCalories: todaysCalorieIntake - todaysCaloriesBurned,
            weightGoalText: goalText,
        };
    }, [weightForCalc, profile, todaysCalorieIntake, todaysCaloriesBurned]);

    const motivationalMessage = useMemo(() => {
        if (netCalories === null || bmr === null) return null;
        const isWeightLoss = (profile?.goal || 'Weight Loss') === 'Weight Loss';

        if (isWeightLoss) {
            if (netCalories < bmr) return { type: 'success', text: `Great job! You're in a calorie deficit of ${bmr - netCalories} kcal today. Keep going!` };
            return { type: 'warning', text: `Your net calories are ${netCalories - bmr} kcal above your BMR. Concentrate on your diet and be more active!` };
        }
        if (netCalories > bmr) return { type: 'success', text: `You're in a calorie surplus of ${netCalories - bmr} kcal today. Supports your weight gain goal!` };
        return { type: 'warning', text: `Your net calories are below BMR. Eat more calorie-dense foods to support your goal.` };
    }, [netCalories, bmr, profile]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="space-y-6">
            {/* Welcome row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {loading ? <Skeleton className="h-8 w-1/2" /> : (
                    <h1 className="text-3xl font-bold">Welcome back, {customer?.name || 'User'}!</h1>
                )}
                {weightGoalText && (
                    <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full">
                                <Target className="h-5 w-5 text-green-600 dark:text-green-300" />
                            </div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">{weightGoalText}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Today's tracker heading */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Today's Snapshot — {format(new Date(), 'EEEE, MMM d')}
                    </h2>
                    <p className="text-sm text-muted-foreground">Your daily health summary at a glance.</p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/daily-tracker/${todayStr}`}>
                        Full Details <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {/* Primary metric cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Calorie Intake</CardTitle>
                        <Flame className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-20" /> : (
                            <div className="text-2xl font-bold">{todaysCalorieIntake} <span className="text-xs font-normal text-muted-foreground">kcal</span></div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            {calorieSource === 'dietician' ? 'Dietician plan' : calorieSource === 'self' ? 'Self-diet log' : 'Not yet logged'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Calories Burned</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-20" /> : (
                            <div className="text-2xl font-bold">{todaysCaloriesBurned} <span className="text-xs font-normal text-muted-foreground">kcal</span></div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Via activity tracker</p>
                    </CardContent>
                </Card>

                <Card className={cn(
                    netCalories !== null && bmr !== null
                        ? netCalories > bmr ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800'
                        : ''
                )}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Calories</CardTitle>
                        {netCalories !== null && bmr !== null && netCalories > bmr
                            ? <TrendingUp className="h-4 w-4 text-red-500" />
                            : <TrendingDown className="h-4 w-4 text-green-500" />}
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-20" /> : (
                            <div className="text-2xl font-bold">
                                {netCalories !== null ? netCalories : todaysCalorieIntake}
                                <span className="text-xs font-normal text-muted-foreground ml-1">kcal</span>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Intake − Burned</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Latest Weight</CardTitle>
                        <Weight className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-20" /> : (
                            <div className="text-2xl font-bold">
                                {latestWeightLog ? `${latestWeightLog.weight}` : 'N/A'}
                                {latestWeightLog && <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            {latestWeightLog ? `Logged ${format(latestWeightLog.date.toDate(), 'MMM d')}` : 'No weight logged'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* BMI / BMR + motivational message */}
            {!loading && weightForCalc && profile?.height && profile?.age && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-1">BMI <Info className="h-3 w-3" /></CardTitle>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={cn('text-2xl font-bold', bmiColor)}>{bmi}</div>
                            <Badge variant="outline" className={cn('text-xs mt-1', bmiColor)}>{bmiCategory}</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-1">BMR <Info className="h-3 w-3" /></CardTitle>
                            <Flame className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{bmr} <span className="text-xs font-normal text-muted-foreground">kcal</span></div>
                            <p className="text-xs text-muted-foreground mt-1">Daily calorie need</p>
                        </CardContent>
                    </Card>

                    {motivationalMessage && (
                        <Card className={cn(
                            'border',
                            motivationalMessage.type === 'success'
                                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                                : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                        )}>
                            <CardContent className="p-4 flex items-start gap-3 h-full">
                                {motivationalMessage.type === 'success'
                                    ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                    : <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />}
                                <p className={cn(
                                    'text-xs font-medium leading-relaxed',
                                    motivationalMessage.type === 'success'
                                        ? 'text-green-800 dark:text-green-200'
                                        : 'text-orange-800 dark:text-orange-200'
                                )}>
                                    {motivationalMessage.text}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Feature cards row */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-primary" />
                            Daily Tracker
                        </CardTitle>
                        <CardDescription>View any day's full health summary.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/daily-tracker">
                                Open Tracker <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            My Plan
                        </CardTitle>
                        <CardDescription>Your current subscription details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loading ? <Skeleton className="h-6 w-3/4" /> : plan && customer?.subscriptionEndDate ? (
                            <div>
                                <p className="font-semibold">{plan.name}</p>
                                <p className="text-sm text-muted-foreground">Expires {format(customer.subscriptionEndDate.toDate(), 'PPP')}</p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">No active plan found.</p>
                        )}
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/subscription">Manage <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Utensils className="h-5 w-5 text-primary" />
                            Today's Diet
                        </CardTitle>
                        <CardDescription>Log your meals to stay on target.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">Track every meal for accurate net calorie insight.</p>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/dietician-diet-plan">
                                View Diet Plan <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
