

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ChevronLeft,
  Calendar as CalendarIcon,
  Check,
  X,
  Weight,
  Utensils,
  BookCopy,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowRight,
  Target,
  ChevronRight,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, runTransaction, Timestamp, onSnapshot, orderBy, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, eachDayOfInterval, isBefore, addMonths, subMonths, isAfter, startOfDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";


type Participant = {
  id: string;
  name: string;
  email: string;
  subscriptionStartDate: Timestamp;
  attendance: { [date: string]: 'present' | 'absent' };
  dietPlanId?: string;
  challengeDuration?: number;
};

type ProfileData = {
    weight?: string;
}

type FoodItem = {
    foodName: string;
    quantity: string;
    calories?: number;
};

type MealOption = {
    foodItems: FoodItem[];
}

type Meal = {
  time: string;
  title: string;
  options: MealOption[];
};

type DietPlan = {
    id: string;
    name: string;
    meals: Meal[];
};

type DietLog = {
    id: string;
    selections: { [mealTime: string]: number };
    notes: { [mealTime: string]: string };
    imageURLs: { [mealTime: string]: string };
    skipped?: { [mealTime: string]: { reason: string } };
    isDaySkipped?: { reason: string };
};

type WeightLog = {
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

const StatCard = ({ title, value, icon, loading }: { title: string, value: string | number, icon: React.ReactNode, loading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function ViewChallengeParticipantPage() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [dietLogs, setDietLogs] = useState<{[key: string]: DietLog}>({});
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date>(new Date());
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  useEffect(() => {
    if (!auth || !db || !customerId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const participantDocRef = doc(db, 'customers', customerId);
          
          const unsubParticipant = onSnapshot(participantDocRef, async (docSnap) => {
              if (docSnap.exists() && docSnap.data().vendorId === user.uid) {
                const participantData = { id: docSnap.id, ...docSnap.data() } as Participant;
                setParticipant(participantData);

                if(participantData.dietPlanId) {
                    const planDoc = await getDoc(doc(db, 'dietPlans', participantData.dietPlanId));
                    if(planDoc.exists()){
                        setDietPlan({ id: planDoc.id, ...planDoc.data()} as DietPlan);
                    }
                }
                 
                const profileDocRef = doc(db, 'userProfiles', customerId);
                const profileDoc = await getDoc(profileDocRef);
                if (profileDoc.exists()) {
                  setProfile(profileDoc.data() as ProfileData);
                }

              } else {
                 toast({ variant: 'destructive', title: 'Error', description: 'Participant not found or access denied.' });
                 router.push('/partner/money-back-challenge');
              }
          });

          const dietLogsQuery = query(collection(db, `users/${customerId}/dieticianPlanLogs`));
          const unsubDietLogs = onSnapshot(dietLogsQuery, (snapshot) => {
            const logsData: {[key: string]: DietLog} = {};
            snapshot.forEach(doc => { logsData[doc.id] = doc.data() as DietLog });
            setDietLogs(logsData);
          });

          const weightLogsQuery = query(collection(db, 'dailyWeightLogs'), where('userId', '==', customerId), orderBy('date', 'desc'));
          const unsubWeightLogs = onSnapshot(weightLogsQuery, (snapshot) => {
            setWeightLogs(snapshot.docs.map(d => ({id: d.id, ...d.data()} as WeightLog)));
          });

          setLoading(false);
          return () => {
              unsubParticipant();
              unsubDietLogs();
              unsubWeightLogs();
          }

        } catch (error) {
          console.error("Error fetching participant data:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch participant data.' });
          setLoading(false);
        }
      } else {
        router.push('/partner/login');
      }
    });

    return () => unsubscribe();
  }, [auth, db, customerId, toast, router]);

  const handleAttendanceChange = async (participantId: string, date: Date, status: 'present' | 'absent' | 'unset') => {
    if (!db) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    const participantDocRef = doc(db, 'customers', participantId);

    try {
        await runTransaction(db, async (transaction) => {
            const participantDoc = await transaction.get(participantDocRef);
            if (!participantDoc.exists()) {
                throw new Error("Participant not found!");
            }
            const currentAttendance = participantDoc.data().attendance || {};
            
            if (status === 'unset') {
                delete currentAttendance[dateKey];
            } else {
                currentAttendance[dateKey] = status;
            }

            transaction.update(participantDocRef, { attendance: currentAttendance });
        });
    } catch (e: any) {
        console.error("Failed to update attendance:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update attendance.' });
    }
  };
  
  const {
      totalAttendance,
      startingWeight,
      currentWeight,
      weightReduced,
      dietLogCount
  } = useMemo(() => {
      const attendance = Object.values(participant?.attendance || {}).filter(a => a === 'present').length;
      const startWeight = Number(profile?.weight);
      const latestWeight = weightLogs.length > 0 ? weightLogs[0].weight : startWeight;
      const reduced = startWeight && latestWeight ? startWeight - latestWeight : 0;
      const logsCount = Object.keys(dietLogs).length;

      return {
          totalAttendance: attendance,
          startingWeight: startWeight,
          currentWeight: latestWeight,
          weightReduced: reduced,
          dietLogCount: logsCount,
      };

  }, [participant, profile, weightLogs, dietLogs]);

  const selectedLogData = useMemo(() => {
    if (!selectedDate) return null;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return {
        attendance: participant?.attendance?.[dateKey],
        dietLog: dietLogs[dateKey],
        weightLog: weightLogs.find(log => isSameDay(log.date.toDate(), selectedDate))
    };
  }, [selectedDate, participant, dietLogs, weightLogs]);

  const calculateLogTotals = (log: DietLog) => {
    let calories = 0;
    if (!dietPlan || !log.selections || log.isDaySkipped) return { calories };

    dietPlan.meals?.forEach(meal => {
        if (log.skipped?.[meal.time]) return;
        const selectionIndex = log.selections[meal.time];
        if (selectionIndex !== undefined) {
            const selectedOption = meal.options[selectionIndex];
            selectedOption?.foodItems.forEach(item => {
                calories += item.calories || 0;
            });
        }
    });
    return { calories: calories.toFixed(0) };
};

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Skeleton className="h-64 w-full max-w-4xl" /></div>;
  }

  if (!participant) {
    return <p className="text-center">Participant not found.</p>;
  }

  return (
    <div className="space-y-6">
        <Card>
        <CardHeader>
            <div className="flex items-center gap-4">
            <Link href="/partner/money-back-challenge">
                <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-primary"/> 
                    Challenge Progress: {participant.name}
                </CardTitle>
                <CardDescription>Daily activity log for {participant.email}.</CardDescription>
            </div>
            </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Attendance" value={`${totalAttendance} / ${participant.challengeDuration || 30} days`} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} loading={loading} />
            <StatCard title="Starting Weight" value={`${startingWeight?.toFixed(1) || 'N/A'} kg`} icon={<Weight className="h-4 w-4 text-muted-foreground" />} loading={loading} />
            <StatCard title="Current Weight" value={`${currentWeight?.toFixed(1) || 'N/A'} kg`} icon={<Weight className="h-4 w-4 text-muted-foreground" />} loading={loading} />
            <StatCard title="Weight Reduced" value={`${weightReduced?.toFixed(1) || '0.0'} kg`} icon={<Target className={cn(weightReduced > 0 ? "text-green-500" : "text-red-500", "h-4 w-4 text-muted-foreground")} />} loading={loading} />
            <StatCard title="Diet Logs" value={`${dietLogCount} days`} icon={<Utensils className="h-4 w-4 text-muted-foreground" />} loading={loading} />
        </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Attendance Calendar</CardTitle>
                <CardDescription>Click on a day to view details and mark attendance.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
                 <div className="flex items-center gap-4 mb-4">
                    <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <h3 className="text-xl font-semibold text-center">{format(month, 'MMMM yyyy')}</h3>
                    <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <Card className="p-4 shadow-lg">
                    <Calendar
                        month={month}
                        onMonthChange={setMonth}
                        onDayClick={(day) => setSelectedDate(day)}
                        selected={selectedDate || undefined}
                        disabled={(date) => 
                            !participant.subscriptionStartDate ||
                            isAfter(date, new Date()) || 
                            isBefore(date, startOfDay(participant.subscriptionStartDate.toDate()))
                        }
                        components={{
                            DayContent: ({ date }) => {
                                const attendanceStatus = participant.attendance?.[format(date, 'yyyy-MM-dd')];
                                return (
                                    <div className={cn("relative w-full h-full flex items-center justify-center", 
                                        attendanceStatus === 'present' && "bg-green-100 dark:bg-green-900/50 rounded-md",
                                        attendanceStatus === 'absent' && "bg-red-100 dark:bg-red-900/50 rounded-md"
                                    )}>
                                       <span className="text-black dark:text-white">{format(date, 'd')}</span>
                                       {attendanceStatus === 'present' && <CheckCircle className="absolute bottom-0 right-0 h-3 w-3 text-green-600" />}
                                       {attendanceStatus === 'absent' && <XCircle className="absolute bottom-0 right-0 h-3 w-3 text-red-500" />}
                                    </div>
                                );
                            }
                        }}
                    />
                </Card>
            </CardContent>
        </Card>
       
        <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
            <DialogContent className="max-w-xl">
                 <DialogHeader>
                    <DialogTitle>Details for: {selectedDate && format(selectedDate, 'PPP')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base">Attendance</CardTitle>
                            {selectedLogData?.attendance && (
                                <Badge variant={selectedLogData.attendance === 'present' ? 'success' : 'destructive'}>
                                    {selectedLogData.attendance}
                                </Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-center items-center gap-2">
                                <Button 
                                    variant={selectedLogData?.attendance === 'present' ? 'default' : 'outline'}
                                    size="sm" 
                                    onClick={() => handleAttendanceChange(participant.id, selectedDate!, 'present')}
                                >
                                    <Check className="mr-2 h-4 w-4" /> Present
                                </Button>
                                <Button 
                                    variant={selectedLogData?.attendance === 'absent' ? 'destructive' : 'outline'}
                                    size="sm" 
                                    onClick={() => handleAttendanceChange(participant.id, selectedDate!, 'absent')}
                                >
                                    <X className="mr-2 h-4 w-4" /> Absent
                                </Button>
                                {selectedLogData?.attendance && <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleAttendanceChange(participant.id, selectedDate!, 'unset')}>Clear</Button>}
                           </div>
                        </CardContent>
                    </Card>
                    {selectedLogData?.weightLog && (
                        <Card>
                            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Weight className="h-4 w-4"/>Weight Log</CardTitle></CardHeader>
                            <CardContent><p className="font-bold text-lg">{selectedLogData.weightLog.weight} kg</p></CardContent>
                        </Card>
                    )}
                    {selectedLogData?.dietLog?.isDaySkipped ? (
                         <Card className="bg-destructive/10"><CardHeader><CardTitle className="text-base text-destructive">Day Skipped</CardTitle></CardHeader><CardContent><p className="text-sm">Reason: {selectedLogData.dietLog.isDaySkipped.reason}</p></CardContent></Card>
                    ) : selectedLogData?.dietLog ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><Utensils className="h-4 w-4"/>Diet Log</CardTitle>
                                <CardDescription>Calories Consumed: {calculateLogTotals(selectedLogData.dietLog).calories} kcal</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {dietPlan?.meals.map(meal => {
                                    const selectionIndex = selectedLogData?.dietLog?.selections[meal.time];
                                    if (selectionIndex === undefined) return null;
                                    const selectedOption = meal.options[selectionIndex];
                                    if(!selectedOption) return null;

                                    return (
                                        <div key={meal.time} className="p-2 border rounded-md text-xs">
                                            <p className="font-semibold">{meal.title}</p>
                                            <ul className="list-disc pl-5 mt-1">
                                                {selectedOption.foodItems.map((item, idx) => <li key={idx}>{item.foodName} ({item.quantity}) - {item.calories?.toFixed(0)} kcal</li>)}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground p-4">No diet log for this day.</p>
                    )}
                </div>
                 <DialogClose asChild><Button type="button" variant="secondary" className="w-full">Close</Button></DialogClose>
            </DialogContent>
        </Dialog>
    </div>
  );
}

