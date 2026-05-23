"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, Flame, Activity, Weight } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

export default function DailyTrackerPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(new Date());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { auth, db } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!userId || !db) { setLoading(false); return; }

    const fetchActiveDates = async () => {
      setLoading(true);
      const monthStart = Timestamp.fromDate(startOfMonth(month));
      const monthEnd = Timestamp.fromDate(endOfMonth(month));
      const datesSet = new Set<string>();

      try {
        const [weightSnap, activitySnap] = await Promise.all([
          getDocs(query(
            collection(db, "dailyWeightLogs"),
            where("userId", "==", userId),
            where("date", ">=", monthStart),
            where("date", "<=", monthEnd)
          )),
          getDocs(query(
            collection(db, `users/${userId}/activityLogs`),
            where("date", ">=", monthStart),
            where("date", "<=", monthEnd)
          )),
        ]);

        weightSnap.forEach(d => datesSet.add(format(d.data().date.toDate(), 'yyyy-MM-dd')));
        activitySnap.forEach(d => datesSet.add(format(d.data().date.toDate(), 'yyyy-MM-dd')));

        // Self-diet plans (may need composite index; graceful fallback)
        try {
          const selfDietSnap = await getDocs(query(
            collection(db, `users/${userId}/selfDietPlans`),
            where("date", ">=", monthStart),
            where("date", "<=", monthEnd)
          ));
          selfDietSnap.forEach(d => {
            if (d.data().date) datesSet.add(format(d.data().date.toDate(), 'yyyy-MM-dd'));
          });
        } catch { /* index not yet created — skip */ }
      } catch (e) {
        console.error("Error fetching active dates:", e);
      }

      setActiveDates(datesSet);
      setLoading(false);
    };

    fetchActiveDates();
  }, [userId, db, month]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    router.push(`/dashboard/daily-tracker/${format(date, 'yyyy-MM-dd')}`);
  };

  const activeDatesArray = useMemo(
    () => Array.from(activeDates).map(d => parseISO(d)),
    [activeDates]
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Daily Tracker
        </h1>
        <p className="text-muted-foreground">Select a date to view your full daily health summary.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Choose a Day</CardTitle>
            <CardDescription>
              Dates marked with a dot have logged data. Click any date to see its summary.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {loading ? (
              <Skeleton className="h-[320px] w-full max-w-xs" />
            ) : (
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                onSelect={handleDateSelect}
                modifiers={{ hasData: activeDatesArray }}
                modifiersClassNames={{ hasData: "day-has-data" }}
                disabled={{ after: new Date() }}
                className="rounded-md"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Access</CardTitle>
              <CardDescription>Jump to any day's summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => router.push(`/dashboard/daily-tracker/${todayStr}`)}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-accent/10 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{format(new Date(), 'EEEE, MMMM d')}</p>
                    <p className="text-sm text-muted-foreground">View today</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What's Tracked</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Flame className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Calorie Intake</p>
                  <p>From dietician plan or self-diet log</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Calories Burned</p>
                  <p>From activity tracker entries</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Weight className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">BMI & BMR</p>
                  <p>Calculated from your logged weight</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-purple-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Net Calorie & Motivation</p>
                  <p>Net = Intake − Burned vs your BMR goal</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
