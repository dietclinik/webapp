

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2, Weight, Scale, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logDailyWeight } from "@/ai/flows/log-daily-weight-flow";
import { cn } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type DailyWeightLog = {
    id: string;
    date: Timestamp;
    weight: number;
    userId: string;
};

const chartConfig = {
  weight: {
    label: "Weight (kg)",
  },
  difference: {
    label: "Difference (kg)",
  }
} satisfies ChartConfig;

const weightSchema = z.object({
  weight: z.coerce.number().min(20, "Weight must be at least 20kg.").max(300, "Weight seems too high."),
});


export default function DailyWeightTrackingPage() {
    const [logs, setLogs] = useState<DailyWeightLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [initialWeight, setInitialWeight] = useState<number | null>(null);
    const [weightGoal, setWeightGoal] = useState<'Weight Loss' | 'Weight Gain'>('Weight Loss');
    const { auth, db } = useFirebase();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof weightSchema>>({
        resolver: zodResolver(weightSchema),
        defaultValues: {
            weight: "" as any,
        },
    });

    useEffect(() => {
        if (!auth) return;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, [auth]);

    useEffect(() => {
        if (!userId || !db) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const fetchInitialData = async () => {
             // Fetch initial weight and goal from profile
            const profileDocRef = doc(db, 'userProfiles', userId);
            try {
                const profileSnap = await getDoc(profileDocRef);
                if (profileSnap.exists()) {
                    setInitialWeight(Number(profileSnap.data().weight) || null);
                    setWeightGoal(profileSnap.data().goal || 'Weight Loss');
                }
            } catch (error: any) {
                 if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: profileDocRef.path,
                        operation: 'get'
                    });
                    errorEmitter.emit('permission-error', permissionError);
                 }
                 console.error("Error fetching initial weight:", error);
            }

            // Listen for weight log updates
            const q = query(
                collection(db, "dailyWeightLogs"),
                where("userId", "==", userId),
                orderBy("date", "asc")
            );

            const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
                const fetchedLogs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DailyWeightLog));
                setLogs(fetchedLogs);
                setLoading(false);
            }, (error) => {
                 if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: `dailyWeightLogs where userId == ${userId}`,
                        operation: 'list'
                    });
                    errorEmitter.emit('permission-error', permissionError);
                 }
                console.error("Error fetching weight logs:", error);
                setLoading(false);
            });

            return unsubscribeSnapshot;
        }
        
        const unsubscribePromise = fetchInitialData();

        return () => {
            unsubscribePromise.then(unsubscribe => {
                if (unsubscribe) {
                    unsubscribe();
                }
            });
        };
    }, [userId, db]);

     const onSubmit = async (data: z.infer<typeof weightSchema>) => {
        setIsSubmitting(true);
        const user = auth?.currentUser;

        if (!user || !db) {
            toast({ variant: 'destructive', title: "Error", description: "You must be logged in to log your weight." });
            setIsSubmitting(false);
            return;
        }

        try {
            await logDailyWeight({
                userId: user.uid,
                weight: data.weight,
            });
            
            toast({ variant: "success", title: "Success", description: "Your weight has been logged." });
            form.reset();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Could not save weight: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const deleteLog = async (logId: string) => {
        if (!db) return;
        const logRef = doc(db, 'dailyWeightLogs', logId);
        try {
            await deleteDoc(logRef);
            toast({ variant: 'success', title: 'Deleted', description: 'Weight log has been deleted.' });
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: logRef.path,
                operation: 'delete'
            });
            errorEmitter.emit('permission-error', permissionError);
            console.error("Error deleting weight log:", error);
        }
    };

    const latestLog = useMemo(() => logs.length > 0 ? logs[logs.length - 1] : null, [logs]);
    
    const totalDifference = useMemo(() => {
        if (initialWeight && latestLog) {
            return latestLog.weight - initialWeight;
        }
        return null;
    }, [initialWeight, latestLog]);

    const chartData = useMemo(() => {
        return logs.map((log, index) => {
          const prevWeight = index > 0 ? logs[index - 1].weight : initialWeight;
          const difference = prevWeight ? log.weight - prevWeight : 0;
          let fill = "hsl(var(--primary))"; // Default/initial color
          if (difference < 0) {
            fill = "hsl(142.1 76.2% 36.3%)"; // green
          } else if (difference > 0) {
            fill = "hsl(0 84.2% 60.2%)"; // red
          } else if (index > 0) {
            fill = "hsl(38.9 98.4% 50.2%)"; // orange
          }
          
          return {
            month: format(log.date.toDate(), 'MMM d'),
            weight: log.weight,
            difference: parseFloat(difference.toFixed(1)),
            fill: fill,
          };
        });
    }, [logs, initialWeight]);

  return (
    <div className="w-full max-w-xs md:max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Weight className="h-5 w-5 text-primary" /> Daily Weight Tracking</h1>
        <p className="text-muted-foreground">Log your weight daily to see your progress over time.</p>
      </div>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Log Today's Weight</CardTitle>
                </CardHeader>
                <CardContent>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="weight"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="sr-only">Weight (kg)</FormLabel>
                                        <FormControl><Input type="number" step="0.1" placeholder="e.g., 70.5 kg" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isSubmitting} className="w-full">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4"/>
                                Save
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Starting Weight</CardTitle>
                    <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-24" /> : 
                     <div className="text-2xl font-bold">{initialWeight ? `${initialWeight} kg` : 'N/A'}</div>
                    }
                    <p className="text-xs text-muted-foreground">Your weight at registration</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Weight</CardTitle>
                    <Weight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-8 w-24" /> : 
                        <div className="text-2xl font-bold">{latestLog ? `${latestLog.weight} kg` : 'N/A'}</div>
                     }
                    <p className="text-xs text-muted-foreground">{latestLog ? `As of ${format(latestLog.date.toDate(), 'PPP')}` : 'Log your weight'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Progress</CardTitle>
                     {totalDifference === null || totalDifference === 0 ? <Scale className="h-4 w-4 text-muted-foreground" /> : totalDifference > 0 ? <TrendingUp className="h-4 w-4 text-red-500" /> : <TrendingDown className="h-4 w-4 text-green-500" />}
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-8 w-24" /> : 
                        <div className={cn("text-2xl font-bold", totalDifference !== null ? (totalDifference > 0 ? "text-red-500" : "text-green-500") : "")}>
                            {totalDifference !== null ? `${totalDifference > 0 ? '+' : ''}${totalDifference.toFixed(1)} kg` : 'N/A'}
                        </div>
                     }
                    <p className="text-xs text-muted-foreground">From starting weight</p>
                </CardContent>
            </Card>
       </div>

        <Card>
            <CardHeader>
            <CardTitle>Weight Progress Chart</CardTitle>
            <CardDescription>Your weight changes over time.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto">
                    {loading ? <Skeleton className="h-[250px] w-full" /> : 
                    chartData.length > 1 ? (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full min-w-[500px]">
                            <ResponsiveContainer>
                                <BarChart data={chartData} margin={{ left: -20, right: 20, top: 10, bottom: 0 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={['dataMin - 2', 'dataMax + 2']} />
                                    <Tooltip
                                        cursor={false}
                                        content={<ChartTooltipContent
                                            indicator="dot"
                                            formatter={(value, name, item) => {
                                                if (name === "weight") {
                                                    return (
                                                    <>
                                                        <div className="font-medium text-foreground">{item.payload.weight} kg</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.payload.difference > 0 ? '+' : ''}{item.payload.difference} kg from previous
                                                        </div>
                                                    </>
                                                    )
                                                }
                                                return value;
                                            }}
                                        />}
                                    />
                                    <Bar dataKey="weight" radius={4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="flex h-[250px] w-full items-center justify-center">
                            <p className="text-muted-foreground text-center">Log your weight for at least two different days to see a progress chart.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
            <CardTitle>Weight Log History</CardTitle>
            <CardDescription>Your previously logged weights.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Desktop Table */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead>Difference</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? Array.from({length: 3}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8"/></TableCell>
                        </TableRow>
                    )) :
                    logs.length > 0 ? logs.slice().reverse().map((log, index, arr) => {
                        const previousLog = arr[index + 1];
                        const difference = previousLog ? log.weight - previousLog.weight : (initialWeight ? log.weight - initialWeight : 0);

                        return (
                            <TableRow key={log.id}>
                                <TableCell>{format(log.date.toDate(), 'PPP')}</TableCell>
                                <TableCell className="font-medium">{log.weight} kg</TableCell>
                                <TableCell>
                                    <span className={cn(
                                        "font-medium flex items-center gap-1",
                                        (weightGoal === 'Weight Loss' && difference < 0) || (weightGoal === 'Weight Gain' && difference > 0) ? "text-green-600" :
                                        (weightGoal === 'Weight Loss' && difference > 0) || (weightGoal === 'Weight Gain' && difference < 0) ? "text-red-600" :
                                        "text-muted-foreground"
                                    )}>
                                        {(difference > 0) ? <TrendingUp className="h-4 w-4"/> : (difference < 0) ? <TrendingDown className="h-4 w-4"/> : ''} 
                                        {difference !== 0 ? `${Math.abs(difference).toFixed(1)} kg` : '-'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => deleteLog(log.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                         <TableRow>
                            <TableCell colSpan={4} className="text-center">No weight logs found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

             {/* Mobile Cards */}
             <div className="grid gap-4 md:hidden">
                {loading ? Array.from({length: 3}).map((_, i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                )) : logs.length > 0 ? logs.slice().reverse().map((log, index, arr) => {
                    const previousLog = arr[index + 1];
                    const difference = previousLog ? log.weight - previousLog.weight : (initialWeight ? log.weight - initialWeight : 0);
                    return (
                        <Card key={log.id}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base">{format(log.date.toDate(), 'PPP')}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => deleteLog(log.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Weight:</span>
                                    <span className="font-semibold">{log.weight} kg</span>
                                </div>
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Difference:</span>
                                    <span className={cn(
                                        "font-semibold flex items-center gap-1",
                                        (weightGoal === 'Weight Loss' && difference < 0) || (weightGoal === 'Weight Gain' && difference > 0) ? "text-green-600" :
                                        (weightGoal === 'Weight Loss' && difference > 0) || (weightGoal === 'Weight Gain' && difference < 0) ? "text-red-600" :
                                        "text-muted-foreground"
                                    )}>
                                        {(difference > 0) ? <TrendingUp className="h-4 w-4"/> : (difference < 0) ? <TrendingDown className="h-4 w-4"/> : ''} 
                                        {difference !== 0 ? `${Math.abs(difference).toFixed(1)} kg` : '-'}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )
                }) : (
                    <div className="text-center py-8 text-muted-foreground">No weight logs found.</div>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
