"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  CalendarDays, ChevronLeft, Flame, Activity, Scale, Info,
  CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  Utensils, Weight
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ProfileData = {
  height?: string;
  age?: string;
  gender?: string;
  goal?: string;
};

type WeightLog = { weight: number };
type ActivityLog = { caloriesBurned: number; activityName: string };

function StatCard({
  label, value, unit, icon, sub, className,
}: {
  label: string; value: string | number | null; unit?: string;
  icon: React.ReactNode; sub?: string; className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value ?? "N/A"}
          {value !== null && unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DailyTrackerDayPage() {
  const params = useParams();
  const router = useRouter();
  const dateStr = params.date as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [weightLog, setWeightLog] = useState<WeightLog | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [calorieIntake, setCalorieIntake] = useState<number>(0);
  const [calorieSource, setCalorieSource] = useState<"dietician" | "self" | "none">("none");
  const { auth, db } = useFirebase();

  const parsedDate = useMemo(() => {
    try { return parseISO(dateStr); } catch { return new Date(); }
  }, [dateStr]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!userId || !db) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      try {
        const dayStart = Timestamp.fromDate(startOfDay(parsedDate));
        const dayEnd = Timestamp.fromDate(endOfDay(parsedDate));
        const dateKey = format(parsedDate, "yyyy-MM-dd");

        const [profileSnap, customerSnap] = await Promise.all([
          getDoc(doc(db, "userProfiles", userId)),
          getDoc(doc(db, "customers", userId)),
        ]);

        let profileData: ProfileData = {};
        let dietPlanId: string | null = null;

        if (profileSnap.exists()) {
          profileData = profileSnap.data() as ProfileData;
          setProfile(profileData);
        }
        if (customerSnap.exists()) {
          dietPlanId = customerSnap.data().dietPlanId || null;
        }

        // Weight for this day
        const weightSnap = await getDocs(query(
          collection(db, "dailyWeightLogs"),
          where("userId", "==", userId),
          where("date", ">=", dayStart),
          where("date", "<=", dayEnd)
        ));
        setWeightLog(weightSnap.empty ? null : { weight: weightSnap.docs[0].data().weight });

        // Activity logs for this day
        const activitySnap = await getDocs(query(
          collection(db, `users/${userId}/activityLogs`),
          where("date", ">=", dayStart),
          where("date", "<=", dayEnd)
        ));
        setActivityLogs(activitySnap.docs.map(d => ({
          caloriesBurned: d.data().caloriesBurned || 0,
          activityName: d.data().activityName || "",
        })));

        // Calorie intake: dietician plan takes priority
        let calories = 0;
        let source: "dietician" | "self" | "none" = "none";

        if (dietPlanId) {
          const [dietLogSnap, dietPlanSnap] = await Promise.all([
            getDoc(doc(db, `users/${userId}/dieticianPlanLogs`, dateKey)),
            getDoc(doc(db, "dietPlans", dietPlanId)),
          ]);
          if (dietLogSnap.exists() && dietPlanSnap.exists()) {
            const logData = dietLogSnap.data();
            const planData = dietPlanSnap.data();
            if (!logData.isDaySkipped) {
              planData.meals?.forEach((meal: any) => {
                if (logData.skipped?.[meal.time]) return;
                const selectedIndices: number[] = logData.selections?.[meal.time] || [];
                selectedIndices.forEach((idx: number) => {
                  const item = meal.foodItems?.[idx];
                  if (item) calories += item.calories || 0;
                });
              });
              if (calories > 0) source = "dietician";
            }
          }
        }

        // Fallback to self-diet
        if (calories === 0) {
          const selfDietSnap = await getDocs(query(
            collection(db, `users/${userId}/selfDietPlans`),
            where("date", ">=", dayStart),
            where("date", "<=", dayEnd)
          ));
          selfDietSnap.docs.forEach(d => {
            d.data().meals?.forEach((meal: any) => {
              meal.foodItems?.forEach((item: any) => { calories += item.calories || 0; });
            });
          });
          if (calories > 0) source = "self";
        }

        setCalorieIntake(Math.round(calories));
        setCalorieSource(source);
      } catch (e) {
        console.error("Error fetching daily tracker data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, db, parsedDate]);

  const totalBurned = useMemo(
    () => Math.round(activityLogs.reduce((s, a) => s + a.caloriesBurned, 0)),
    [activityLogs]
  );

  const { bmi, bmiCategory, bmiColor, bmr, netCalories } = useMemo(() => {
    if (!weightLog || !profile?.height || !profile?.age || !profile?.gender) {
      return { bmi: null, bmiCategory: null, bmiColor: "", bmr: null, netCalories: null };
    }
    const w = Number(weightLog.weight);
    const hM = Number(profile.height) / 100;
    const age = Number(profile.age);

    const bmiVal = w / (hM * hM);
    let cat = "Normal", color = "text-green-600";
    if (bmiVal < 18.5) { cat = "Underweight"; color = "text-blue-600"; }
    else if (bmiVal < 25) { cat = "Normal"; color = "text-green-600"; }
    else if (bmiVal < 30) { cat = "Overweight"; color = "text-orange-500"; }
    else { cat = "Obese"; color = "text-red-600"; }

    const bmrVal = profile.gender === "male"
      ? 10 * w + 6.25 * (hM * 100) - 5 * age + 5
      : 10 * w + 6.25 * (hM * 100) - 5 * age - 161;

    return {
      bmi: bmiVal.toFixed(1),
      bmiCategory: cat,
      bmiColor: color,
      bmr: Math.round(bmrVal),
      netCalories: calorieIntake - totalBurned,
    };
  }, [weightLog, profile, calorieIntake, totalBurned]);

  const motivationalMessage = useMemo(() => {
    if (netCalories === null || bmr === null) return null;
    const isWeightLoss = (profile?.goal || "Weight Loss") === "Weight Loss";

    if (isWeightLoss) {
      if (netCalories < bmr) {
        return {
          type: "success",
          text: `Excellent! You're in a calorie deficit of ${bmr - netCalories} kcal today — exactly what you need for weight loss. Keep this momentum going!`,
        };
      }
      const excess = netCalories - bmr;
      return {
        type: "warning",
        text: `Your net calories are ${excess} kcal above your BMR. Concentrate on your diet and add more physical activity to stay on track!`,
      };
    }

    // Weight Gain
    if (netCalories > bmr) {
      return {
        type: "success",
        text: `You're in a calorie surplus of ${netCalories - bmr} kcal today. This supports your weight gain goal. Stay consistent!`,
      };
    }
    return {
      type: "warning",
      text: `Your net calories are below your BMR. Eat more calorie-dense foods throughout the day to support your weight gain goal!`,
    };
  }, [netCalories, bmr, profile]);

  const netPct = useMemo(() => {
    if (!bmr || netCalories === null) return 0;
    return Math.min(150, Math.round((netCalories / bmr) * 100));
  }, [netCalories, bmr]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  const noDataAtAll = calorieIntake === 0 && totalBurned === 0 && !weightLog;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/daily-tracker")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{format(parsedDate, "EEEE, MMMM d, yyyy")}</h1>
          <p className="text-muted-foreground text-sm">Daily health summary</p>
        </div>
      </div>

      {noDataAtAll && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No data logged for this day.</p>
            <p className="text-sm mt-1">Log your weight, diet, and activities to see your summary here.</p>
          </CardContent>
        </Card>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Calorie Intake"
          value={calorieIntake || null}
          unit="kcal"
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          sub={calorieSource === "dietician" ? "From dietician plan" : calorieSource === "self" ? "From self-diet" : "No diet logged"}
        />
        <StatCard
          label="Calories Burned"
          value={totalBurned || null}
          unit="kcal"
          icon={<Activity className="h-4 w-4 text-green-500" />}
          sub={activityLogs.length > 0 ? `${activityLogs.length} activit${activityLogs.length === 1 ? "y" : "ies"}` : "No activities logged"}
        />
        <StatCard
          label="Net Calories"
          value={netCalories !== null ? netCalories : calorieIntake > 0 ? calorieIntake : null}
          unit="kcal"
          icon={netCalories !== null && bmr !== null && netCalories > bmr
            ? <TrendingUp className="h-4 w-4 text-red-500" />
            : <TrendingDown className="h-4 w-4 text-green-500" />}
          sub="Intake − Burned"
          className={netCalories !== null && bmr !== null
            ? netCalories > bmr ? "border-red-200 dark:border-red-800" : "border-green-200 dark:border-green-800"
            : ""}
        />
        <StatCard
          label="Logged Weight"
          value={weightLog ? weightLog.weight : null}
          unit="kg"
          icon={<Weight className="h-4 w-4 text-blue-500" />}
          sub={weightLog ? "Weight log found" : "No weight logged"}
        />
      </div>

      {/* BMI / BMR row */}
      {weightLog && profile?.height && profile?.age && profile?.gender ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                BMI <Info className="h-3 w-3" />
              </CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", bmiColor)}>{bmi}</div>
              <Badge variant="outline" className={cn("text-xs mt-1", bmiColor)}>{bmiCategory}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                BMR <Info className="h-3 w-3" />
              </CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bmr} <span className="text-sm font-normal text-muted-foreground">kcal</span></div>
              <p className="text-xs text-muted-foreground mt-1">Daily calorie need</p>
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Net vs BMR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500",
                      netPct > 100 ? "bg-red-500" : "bg-green-500"
                    )}
                    style={{ width: `${Math.min(100, netPct)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold shrink-0">{netPct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Net {netCalories ?? calorieIntake} kcal vs BMR {bmr} kcal/day
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
            <Info className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              {!weightLog
                ? "Log your weight today to see BMI & BMR calculations."
                : "Complete your profile (height, age, gender) to unlock BMI & BMR."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Motivational message */}
      {motivationalMessage && (
        <Card className={cn(
          "border",
          motivationalMessage.type === "success"
            ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
            : "border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800"
        )}>
          <CardContent className="p-4 flex items-start gap-3">
            {motivationalMessage.type === "success"
              ? <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />}
            <p className={cn(
              "text-sm font-medium leading-relaxed",
              motivationalMessage.type === "success"
                ? "text-green-800 dark:text-green-200"
                : "text-orange-800 dark:text-orange-200"
            )}>
              {motivationalMessage.text}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Activity breakdown */}
      {activityLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Activities Logged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activityLogs.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{a.activityName}</span>
                  <span className="font-semibold text-orange-600">{Math.round(a.caloriesBurned)} kcal burned</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="text-orange-600">{totalBurned} kcal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/daily-weight-tracking">Log Weight</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/activity-tracker">Log Activity</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/self-diet-plan/builder">Self Diet</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/dietician-diet-plan">
            <Utensils className="h-3.5 w-3.5 mr-1" />Dietician Plan
          </Link>
        </Button>
      </div>
    </div>
  );
}

