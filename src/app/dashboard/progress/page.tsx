

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, addDoc } from "firebase/firestore";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Save, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logMeasurements } from "@/ai/flows/log-measurements-flow";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type MeasurementLog = {
    id: string;
    date: Timestamp;
    weight: number;
    neck: number;
    shoulder: number;
    chest: number;
    bicep: number;
    upperAbdominal: number;
    waist: number;
    lowerAbdominal: number;
    hips: number;
    thigh: number;
    calf: number;
    userId: string;
    [key: string]: any; // For custom fields
};

type ProfileData = {
    age?: string;
    gender?: string;
    height?: string;
    goal?: 'Weight Loss' | 'Weight Gain';
}

type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'switch';
  required: boolean;
  placeholder?: string;
};

const chartConfig = {
  weight: {
    label: "Weight (kg)",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const baseMeasurementSchema = z.object({
  weight: z.coerce.number().min(1, "Weight is required."),
  neck: z.coerce.number().min(1, "Neck is required."),
  shoulder: z.coerce.number().min(1, "Shoulder is required."),
  chest: z.coerce.number().min(1, "Chest measurement is required."),
  bicep: z.coerce.number().min(1, "Bicep is required."),
  upperAbdominal: z.coerce.number().min(1, "Upper Abdominal is required."),
  waist: z.coerce.number().min(1, "Waist measurement is required."),
  lowerAbdominal: z.coerce.number().min(1, "Lower Abdominal is required."),
  hips: z.coerce.number().min(1, "Hips measurement is required."),
  thigh: z.coerce.number().min(1, "Thigh is required."),
  calf: z.coerce.number().min(1, "Calf is required."),
});


function LogMeasurementDialog({ onLogAdded, customFields }: { onLogAdded: () => void, customFields: CustomField[] }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const { auth, db } = useFirebase();

    const [dynamicSchema, setDynamicSchema] = useState(baseMeasurementSchema);

    useEffect(() => {
        let schema = baseMeasurementSchema;
        for (const field of customFields) {
            let fieldSchema;
             switch (field.type) {
                case 'number':
                    fieldSchema = z.coerce.number();
                    break;
                default:
                    fieldSchema = z.string();
            }
            if(field.required) {
                fieldSchema = (fieldSchema as z.ZodNumber | z.ZodString).min(1, `${field.label} is required.`);
            } else {
                 fieldSchema = fieldSchema.optional();
            }
            schema = schema.extend({ [field.id]: fieldSchema });
        }
        setDynamicSchema(schema);
    }, [customFields]);

    const form = useForm<z.infer<typeof dynamicSchema>>({
        resolver: zodResolver(dynamicSchema),
    });
    
     useEffect(() => {
        const defaultValues: { [key: string]: any } = {
            weight: "" as any, neck: "" as any, shoulder: "" as any, chest: "" as any, bicep: "" as any, upperAbdominal: "" as any, waist: "" as any, lowerAbdominal: "" as any, hips: "" as any, thigh: "" as any, calf: "" as any
        };
        customFields.forEach(field => {
            defaultValues[field.id] = field.type === 'number' ? '' : '';
        });
        form.reset(defaultValues);
    }, [customFields, form]);


    const onSubmit = async (data: z.infer<typeof dynamicSchema>) => {
        setIsSubmitting(true);
        const user = auth?.currentUser;

        if (!user || !db) {
            toast({ variant: 'destructive', title: "Error", description: "You must be logged in to log measurements." });
            setIsSubmitting(false);
            return;
        }

        try {
            await logMeasurements({
                userId: user.uid,
                ...data
            });
            
            toast({ variant: "success", title: "Success", description: "Your measurements have been logged." });
            form.reset();
            onLogAdded(); // Callback to refresh data on parent
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Could not save measurements: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                    Log New Measurements
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                 <DialogHeader>
                    <DialogTitle>Log New Measurements</DialogTitle>
                    <DialogDescription>Enter your latest measurements to track your progress.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="weight" render={({ field }) => (
                                <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" placeholder="e.g., 70.5" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="neck" render={({ field }) => (
                                <FormItem><FormLabel>Neck (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 15.5" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="shoulder" render={({ field }) => (
                                <FormItem><FormLabel>Shoulder (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 45" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="chest" render={({ field }) => (
                                <FormItem><FormLabel>Chest (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 38" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="bicep" render={({ field }) => (
                                <FormItem><FormLabel>Bicep (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 14" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="upperAbdominal" render={({ field }) => (
                                <FormItem><FormLabel>U. Abdominal (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 34" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="waist" render={({ field }) => (
                                <FormItem><FormLabel>Waist (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 32" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="lowerAbdominal" render={({ field }) => (
                                <FormItem><FormLabel>L. Abdominal (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 35" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="hips" render={({ field }) => (
                                <FormItem><FormLabel>Hips (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 40" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="thigh" render={({ field }) => (
                                <FormItem><FormLabel>Thigh (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 22" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="calf" render={({ field }) => (
                                <FormItem><FormLabel>Calf (in)</FormLabel><FormControl><Input type="number" placeholder="e.g., 15" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        {customFields.map(field => (
                             <FormField
                                key={field.id}
                                control={form.control}
                                name={field.id}
                                render={({ field: formField }) => (
                                    <FormItem>
                                        <FormLabel>{field.label}</FormLabel>
                                        <FormControl><Input type={field.type} placeholder={field.placeholder} {...formField} /></FormControl><FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                        <DialogFooter className="pt-4">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4"/>
                                Save Log
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default function ProgressPage() {
    const [logs, setLogs] = useState<MeasurementLog[]>([]);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const { auth, db } = useFirebase();
    const { settings } = useSettings();

    const customFields = useMemo(() => {
        return settings?.customFields?.measurements || [];
    }, [settings]);

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

    const fetchAllData = useCallback(async () => {
        if (!userId || !db) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const profileDocRef = doc(db, 'userProfiles', userId);
        try {
            const profileSnap = await getDoc(profileDocRef);
            if (profileSnap.exists()) {
                setProfile(profileSnap.data() as ProfileData);
            }
        } catch (error) {
            console.error("Error fetching profile data:", error);
        }

        const q = query(
            collection(db, "measurementLogs"),
            where("userId", "==", userId),
            orderBy("date", "asc")
        );

        const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
            const fetchedLogs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MeasurementLog));
            setLogs(fetchedLogs);
            setLoading(false);
        }, (error) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `measurementLogs where userId == ${userId}`,
                    operation: 'list'
                }));
            }
            console.error("Error fetching progress data:", error);
            setLoading(false);
        });

        return unsubscribeSnapshot;
    }, [userId, db]);


    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        const init = async () => {
            unsubscribe = await fetchAllData();
        }
        init();
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [fetchAllData]);

    const latestLog = useMemo(() => logs.length > 0 ? logs[logs.length - 1] : null, [logs]);
    
    const { bmi, bmr } = useMemo(() => {
        if (!latestLog || !profile?.height || !profile?.age || !profile?.gender) {
            return { bmi: null, bmr: null };
        }
        const heightInMeters = Number(profile.height) / 100;
        const weightInKg = Number(latestLog.weight);
        const ageInYears = Number(profile.age);
        const gender = profile.gender;

        const bmiValue = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);

        let bmrValue = 0;
        if (gender === 'male') {
            bmrValue = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5;
        } else {
            bmrValue = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161;
        }

        return { bmi: bmiValue, bmr: bmrValue.toFixed(0) };
    }, [latestLog, profile]);

    const chartData = useMemo(() => {
        return logs.map(log => ({
            month: format(log.date.toDate(), 'MMM d'),
            weight: log.weight,
        }));
    }, [logs]);

    const MeasurementChange = ({current, previous}: {current?: number, previous?: number}) => {
        if(previous === undefined || current === undefined || previous === null || current === null) return <span className="text-muted-foreground">-</span>;
        
        const difference = current - previous;
        const goal = profile?.goal || 'Weight Loss';
        
        if (difference === 0) {
             return (
                <span className="font-medium flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    0.0
                </span>
            );
        }

        const isLoss = difference < 0;
        let isPositiveChange;
        
        if (goal === 'Weight Loss') {
            isPositiveChange = isLoss;
        } else { // Weight Gain
            isPositiveChange = !isLoss;
        }

        return (
             <span className={cn(
                "font-medium flex items-center justify-center gap-1 text-xs",
                isPositiveChange ? "text-green-600" : "text-red-600"
            )}>
                {isLoss ? <TrendingDown className="h-3 w-3"/> : <TrendingUp className="h-3 w-3"/>} 
                {difference.toFixed(1)}
            </span>
        )
    }
    
    const MobileMeasurementItem = ({label, value, previousValue}: {label: string, value: number, previousValue?: number}) => (
        <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">{label}:</span> 
            <div className="flex items-center gap-2 font-semibold">
                {value} in <MeasurementChange current={value} previous={previousValue} />
            </div>
        </div>
    );

  return (
    <div className="w-full max-w-xs md:max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">Your Monthly Progress</h1>
          <p className="text-muted-foreground">Visualize your journey and celebrate your milestones.</p>
        </div>
        <LogMeasurementDialog onLogAdded={fetchAllData} customFields={customFields} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current Weight</CardTitle>
            <CardDescription>{latestLog ? `As of ${format(latestLog.date.toDate(), 'PPP')}` : 'No data'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : 
             <p className="text-2xl font-bold">{latestLog ? `${latestLog.weight} kg` : <span className="text-xl text-muted-foreground">N/A</span>}</p>
            }
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>BMI</CardTitle>
            <CardDescription>Body Mass Index</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-8 w-20" /> : 
                <p className="text-2xl font-bold">{bmi || <span className="text-xl text-muted-foreground">N/A</span>}</p>
             }
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>BMR</CardTitle>
            <CardDescription>Basal Metabolic Rate</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-8 w-32" /> :
                <p className="text-2xl font-bold">{bmr ? `${bmr} kcal` : <span className="text-xl text-muted-foreground">N/A</span>}</p>
             }
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weight Progress</CardTitle>
          <CardDescription>Your weight changes over time.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="overflow-auto">
                {loading ? <Skeleton className="h-[300px] w-full" /> : 
                chartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full min-w-[500px]">
                        <ResponsiveContainer>
                            <AreaChart data={chartData} margin={{ left: -20, right: 20, top: 10, bottom: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={['dataMin - 2', 'dataMax + 2']} />
                                <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                                <defs>
                                    <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-weight)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-weight)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <Area dataKey="weight" type="monotone" fill="url(#fillWeight)" stroke="var(--color-weight)" stackId="a" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <div className="flex h-[300px] w-full items-center justify-center">
                        <p className="text-muted-foreground">No weight progress data available. Log your first measurement to see the chart.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div>
                <CardTitle>Measurement Log</CardTitle>
                <CardDescription>Your weekly check-in data.</CardDescription>
            </div>
        </CardHeader>
        <CardContent>
            {/* Desktop Table */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">Date</TableHead>
                        <TableHead className="text-center">Weight</TableHead>
                        <TableHead className="text-center">Neck</TableHead>
                        <TableHead className="text-center">Shoulder</TableHead>
                        <TableHead className="text-center">Chest</TableHead>
                        <TableHead className="text-center">Bicep</TableHead>
                        <TableHead className="text-center">U. Abdominal</TableHead>
                        <TableHead className="text-center">Waist</TableHead>
                        <TableHead className="text-center">L. Abdominal</TableHead>
                        <TableHead className="text-center">Hips</TableHead>
                        <TableHead className="text-center">Thigh</TableHead>
                        <TableHead className="text-center">Calf</TableHead>
                        {customFields.map(field => <TableHead key={field.id} className="text-center">{field.label}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? Array.from({length: 3}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={12 + customFields.length}><Skeleton className="h-5 w-full"/></TableCell>
                        </TableRow>
                    )) :
                    logs.length > 0 ? logs.slice().reverse().map((log, index, arr) => {
                        const previousLog = arr[index + 1];
                        return (
                            <TableRow key={log.id}>
                                <TableCell className="text-center">{format(log.date.toDate(), 'PPP')}</TableCell>
                                <TableCell className="text-center">{log.weight} kg <MeasurementChange current={log.weight} previous={previousLog?.weight} /></TableCell>
                                <TableCell className="text-center">{log.neck} in <MeasurementChange current={log.neck} previous={previousLog?.neck} /></TableCell>
                                <TableCell className="text-center">{log.shoulder} in <MeasurementChange current={log.shoulder} previous={previousLog?.shoulder} /></TableCell>
                                <TableCell className="text-center">{log.chest} in <MeasurementChange current={log.chest} previous={previousLog?.chest} /></TableCell>
                                <TableCell className="text-center">{log.bicep} in <MeasurementChange current={log.bicep} previous={previousLog?.bicep} /></TableCell>
                                <TableCell className="text-center">{log.upperAbdominal} in <MeasurementChange current={log.upperAbdominal} previous={previousLog?.upperAbdominal} /></TableCell>
                                <TableCell className="text-center">{log.waist} in <MeasurementChange current={log.waist} previous={previousLog?.waist} /></TableCell>
                                <TableCell className="text-center">{log.lowerAbdominal} in <MeasurementChange current={log.lowerAbdominal} previous={previousLog?.lowerAbdominal} /></TableCell>
                                <TableCell className="text-center">{log.hips} in <MeasurementChange current={log.hips} previous={previousLog?.hips} /></TableCell>
                                <TableCell className="text-center">{log.thigh} in <MeasurementChange current={log.thigh} previous={previousLog?.thigh} /></TableCell>
                                <TableCell className="text-center">{log.calf} in <MeasurementChange current={log.calf} previous={previousLog?.calf} /></TableCell>
                                {customFields.map(field => <TableCell key={field.id} className="text-center">{log[field.id] || 'N/A'}</TableCell>)}
                            </TableRow>
                        )
                    }) : (
                         <TableRow>
                            <TableCell colSpan={12 + customFields.length} className="text-center">No measurement logs found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {/* Mobile Cards */}
             <div className="grid gap-4 md:hidden">
              {loading ? Array.from({length: 3}).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
              )) : logs.length > 0 ? logs.slice().reverse().map((log, index, arr) => {
                  const previousLog = arr[index + 1];
                  return (
                    <Card key={log.id}>
                        <CardHeader>
                            <CardTitle>{format(log.date.toDate(), 'PPP')}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            <MobileMeasurementItem label="Weight" value={log.weight} previousValue={previousLog?.weight} />
                            <MobileMeasurementItem label="Neck" value={log.neck} previousValue={previousLog?.neck} />
                            <MobileMeasurementItem label="Shoulder" value={log.shoulder} previousValue={previousLog?.shoulder} />
                            <MobileMeasurementItem label="Chest" value={log.chest} previousValue={previousLog?.chest} />
                            <MobileMeasurementItem label="Bicep" value={log.bicep} previousValue={previousLog?.bicep} />
                            <MobileMeasurementItem label="U. Abdominal" value={log.upperAbdominal} previousValue={previousLog?.upperAbdominal} />
                            <MobileMeasurementItem label="Waist" value={log.waist} previousValue={previousLog?.waist} />
                            <MobileMeasurementItem label="L. Abdominal" value={log.lowerAbdominal} previousValue={previousLog?.lowerAbdominal} />
                            <MobileMeasurementItem label="Hips" value={log.hips} previousValue={previousLog?.hips} />
                            <MobileMeasurementItem label="Thigh" value={log.thigh} previousValue={previousLog?.thigh} />
                            <MobileMeasurementItem label="Calf" value={log.calf} previousValue={previousLog?.calf} />
                            {customFields.map(field => (
                               <div key={field.id} className="flex justify-between py-2 border-b"><span className="text-muted-foreground">{field.label}:</span> <span className="font-semibold">{log[field.id] || 'N/A'}</span></div>
                            ))}
                        </CardContent>
                    </Card>
                )}) : (
                <div className="text-center py-8 text-muted-foreground">No measurement logs found.</div>
              )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
