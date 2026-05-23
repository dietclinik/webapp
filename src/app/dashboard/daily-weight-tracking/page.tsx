

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2, Weight, Scale, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  weight: { label: "Weight (kg)" },
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
    const [chartMonth, setChartMonth] = useState<Date>(startOfMonth(new Date()));
    const { auth, db } = useFirebase();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof weightSchema>>({
        resolver: zodResolver(weightSchema),
        defaultValues: { weight: "" as any },
    });

    useEffect(() => {
        if (!auth) return;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) { setUserId(user.uid); }
            else { setUserId(null); setLoading(false); }
        });
        return () => unsubscribeAuth();
    }, [auth]);

    useEffect(() => {
        if (!userId || !db) { setLoading(false); return; }
        setLoading(true);

        const fetchInitialData = async () => {
            const profileDocRef = doc(db, 'userProfiles', userId);
            try {
                const profileSnap = await getDoc(profileDocRef);
                if (profileSnap.exists()) {
                    setInitialWeight(Number(profileSnap.data().weight) || null);
                    setWeightGoal(profileSnap.data().goal || 'Weight Loss');
                }
            } catch (error: any) {
                if (error.code === 'permission-denied') {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: profileDocRef.path, operation: 'get' }));
                }
                console.error("Error fetching initial weight:", error);
            }

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
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `dailyWeightLogs where userId == ${userId}`, operation: 'list' }));
                }
                console.error("Error fetching weight logs:", error);
                setLoading(false);
            });

            return unsubscribeSnapshot;
        };

        const unsubscribePromise = fetchInitialData();
        return () => {
            unsubscribePromise.then(unsub => { if (unsub) unsub(); });
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
            await logDailyWeight({ userId: user.uid, weight: data.weight });
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
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: logRef.path, operation: 'delete' }));
            console.error("Error deleting weight log:", error);
        }
    };

    const latestLog = useMemo(() => logs.length > 0 ? logs[logs.length - 1] : null, [logs]);

    const totalDifference = useMemo(() => {
        if (initialWeight && latestLog) return latestLog.weight - initialWeight;
        return null;
    }, [initialWeight, latestLog]);

    // Filter logs to the selected chart month
    const monthLogs = useMemo(() => {
        return logs.filter(log => isSameMonth(log.date.toDate(), chartMonth));
    }, [logs, chartMonth]);

    // Build horizontal chart data: date on Y, weight on X
    const chartData = useMemo(() => {
        return monthLogs.map((log, index) => {
            const prevLog = index > 0 ? monthLogs[index - 1] : null;
            const prevWeight = prevLog ? prevLog.weight : (initialWeight ?? log.weight);
            const difference = log.weight - prevWeight;
            let fill = "hsl(var(--primary))";
            if (difference < 0) fill = "hsl(142.1 76.2% 36.3%)";
            else if (difference > 0) fill = "hsl(0 84.2% 60.2%)";
            else if (index > 0) fill = "hsl(38.9 98.4% 50.2%)";
            return {
                date: format(log.date.toDate(), 'MMM d'),
                weight: log.weight,
                difference: parseFloat(difference.toFixed(1)),
                fill,
            };
        });
    }, [monthLogs, initialWeight]);

    // Weight domain for X-axis: give some padding
    const weightDomain = useMemo(() => {
        if (chartData.length === 0) return ['auto', 'auto'];
        const weights = chartData.map(d => d.weight);
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        return [Math.floor(min - 2), Math.ceil(max + 2)];
    }, [chartData]);

    const canGoPrev = useMemo(() => logs.some(l => l.date.toDate() < startOfMonth(chartMonth)), [logs, chartMonth]);
    const canGoNext = useMemo(() => !isSameMonth(chartMonth, new Date()), [chartMonth]);

    // Dynamic chart height: at least 220px, 40px per bar
    const chartHeight = Math.max(220, chartData.length * 44);

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
                                <FormField control={form.control} name="weight" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="sr-only">Weight (kg)</FormLabel>
                                        <FormControl><Input type="number" step="0.1" placeholder="e.g., 70.5 kg" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Save className="mr-2 h-4 w-4" /> Save
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
                        {totalDifference === null || totalDifference === 0
                            ? <Scale className="h-4 w-4 text-muted-foreground" />
                            : totalDifference > 0
                            ? <TrendingUp className="h-4 w-4 text-red-500" />
                            : <TrendingDown className="h-4 w-4 text-green-500" />}
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

            {/* Horizontal Bar Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <CardTitle>Weight Progress Chart</CardTitle>
                            <CardDescription>
                                {chartData.length > 0
                                    ? `${chartData.length} entr${chartData.length === 1 ? 'y' : 'ies'} for ${format(chartMonth, 'MMMM yyyy')}`
                                    : `No entries for ${format(chartMonth, 'MMMM yyyy')}`}
                            </CardDescription>
                        </div>
                        {/* Month navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline" size="icon"
                                onClick={() => setChartMonth(m => subMonths(m, 1))}
                                disabled={!canGoPrev}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium w-28 text-center">{format(chartMonth, 'MMMM yyyy')}</span>
                            <Button
                                variant="outline" size="icon"
                                onClick={() => setChartMonth(m => addMonths(m, 1))}
                                disabled={!canGoNext}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-[250px] w-full" /> :
                        chartData.length >= 1 ? (
                            <div className="overflow-auto">
                                <ChartContainer config={chartConfig} style={{ height: chartHeight, minWidth: 320 }} className="w-full">
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart
                                            data={chartData}
                                            layout="vertical"
                                            margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                                        >
                                            <CartesianGrid horizontal={false} />
                                            <XAxis
                                                type="number"
                                                domain={weightDomain as [number, number]}
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                tickFormatter={(v) => `${v} kg`}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="date"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                width={52}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <ChartTooltip
                                                cursor={false}
                                                content={
                                                    <ChartTooltipContent
                                                        indicator="dot"
                                                        formatter={(value, name, item) => (
                                                            <>
                                                                <div className="font-medium text-foreground">{item.payload.weight} kg</div>
                                                                {item.payload.difference !== 0 && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {item.payload.difference > 0 ? '+' : ''}{item.payload.difference} kg from previous
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    />
                                                }
                                            />
                                            <Bar dataKey="weight" radius={4}>
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                        ) : (
                            <div className="flex h-[200px] w-full items-center justify-center">
                                <p className="text-muted-foreground text-center text-sm">
                                    No weight entries for {format(chartMonth, 'MMMM yyyy')}.<br />
                                    Use the arrows to navigate to a month with data.
                                </p>
                            </div>
                        )
                    }
                </CardContent>
            </Card>

            {/* History table */}
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
                            {loading ? Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                                </TableRow>
                            )) : logs.length > 0 ? logs.slice().reverse().map((log, index, arr) => {
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
                                                {difference > 0 ? <TrendingUp className="h-4 w-4" /> : difference < 0 ? <TrendingDown className="h-4 w-4" /> : ''}
                                                {difference !== 0 ? `${Math.abs(difference).toFixed(1)} kg` : '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteLog(log.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">No weight logs found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {/* Mobile Cards */}
                    <div className="grid gap-4 md:hidden">
                        {loading ? Array.from({ length: 3 }).map((_, i) => (
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
                                                {difference > 0 ? <TrendingUp className="h-4 w-4" /> : difference < 0 ? <TrendingDown className="h-4 w-4" /> : ''}
                                                {difference !== 0 ? `${Math.abs(difference).toFixed(1)} kg` : '—'}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        }) : (
                            <div className="text-center py-8 text-muted-foreground">No weight logs found.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
