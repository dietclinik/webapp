
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Form,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Activity, Loader2, Save, Trash2, Flame, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, onSnapshot, orderBy, Timestamp, deleteDoc, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateCaloriesBurned } from "@/ai/flows/calculate-calories-burned-flow";
import Image from 'next/image';
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { cn } from "@/lib/utils";

type ActivityOption = { id: string; name: string; iconUrl?: string };
type DurationOption = { id: string; value: string };
type IntensityOption = { id: string; name: string };

type ActivityLog = {
    id: string;
    userId: string;
    activityName: string;
    durationValue: string;
    intensityName: string;
    caloriesBurned: number;
    date: Timestamp;
};

const activityLogSchema = z.object({
  activityId: z.string().min(1, "Please select an activity."),
  durationId: z.string().min(1, "Please select a duration."),
  intensityId: z.string().min(1, "Please select an intensity level."),
});

const StepCard = ({ label, icon, selected, onClick }: { label: string, icon: React.ReactNode, selected: boolean, onClick: () => void }) => (
    <Card 
        onClick={onClick}
        className={cn(
            "cursor-pointer transition-all hover:shadow-md hover:border-primary",
            selected && "border-primary ring-2 ring-primary"
        )}
    >
        <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            {icon}
            <span className="text-sm font-medium text-center">{label}</span>
        </CardContent>
    </Card>
)

export default function ActivityTrackerPage() {
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [durations, setDurations] = useState<DurationOption[]>([]);
  const [intensityLevels, setIntensityLevels] = useState<IntensityOption[]>([]);
  const [loggedActivities, setLoggedActivities] = useState<ActivityLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userWeight, setUserWeight] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const { settings } = useSettings();
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof activityLogSchema>>({
    resolver: zodResolver(activityLogSchema),
    defaultValues: {
        activityId: '',
        durationId: '',
        intensityId: '',
    }
  });

  const watchActivityId = form.watch('activityId');
  const watchDurationId = form.watch('durationId');
  const watchIntensityId = form.watch('intensityId');

  const steps = [
    { title: "Select Activity", field: "activityId" },
    { title: "Select Duration", field: "durationId" },
    { title: "Select Intensity", field: "intensityId" },
  ];

  const handleNextStep = () => {
    const currentField = steps[currentStep].field;
    if(form.getValues(currentField as keyof z.infer<typeof activityLogSchema>)){
        setCurrentStep(prev => prev + 1);
    } else {
        toast({ variant: 'destructive', title: 'Selection Required', description: 'Please make a selection to continue.'});
    }
  }
  const handlePrevStep = () => setCurrentStep(prev => prev - 1);


  useEffect(() => {
    if (settings?.activitySettings) {
      setActivities(settings.activitySettings.activities || []);
      setDurations(settings.activitySettings.durations || []);
      setIntensityLevels(settings.activitySettings.intensityLevels || []);
    }
  }, [settings]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        setUserId(user ? user.uid : null);
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
        const profileDocRef = doc(db, 'userProfiles', userId);
        try {
            const profileSnap = await getDoc(profileDocRef);
            if(profileSnap.exists()) {
                setUserWeight(Number(profileSnap.data().weight));
            }
        } catch(e: any) {
             if (e.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: profileDocRef.path, operation: 'get' }));
            } else {
                console.error("Could not fetch user weight.", e);
            }
        }
    }
    fetchInitialData();


    const q = query(
        collection(db, `users/${userId}/activityLogs`),
        orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
        setLoggedActivities(logs);
        setLoading(false);
    }, (error) => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${userId}/activityLogs`, operation: 'list' }));
        } else {
            console.error("Error fetching activity logs:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not load your activity history." });
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, db, toast]);


  const onSubmit = async (data: z.infer<typeof activityLogSchema>) => {
    if (!userId || !userWeight) {
        toast({ variant: 'destructive', title: "Error", description: "Could not log activity. User data is missing." });
        return;
    }
    setIsSubmitting(true);
    
    const activity = activities.find(a => a.id === data.activityId);
    const duration = durations.find(d => d.id === data.durationId);
    const intensity = intensityLevels.find(i => i.id === data.intensityId);

    if (!activity || !duration || !intensity) {
        toast({ variant: "destructive", title: "Error", description: "Invalid selection." });
        setIsSubmitting(false);
        return;
    }

    try {
        const { caloriesBurned } = await calculateCaloriesBurned({
            activityName: activity.name,
            durationValue: duration.value,
            intensityName: intensity.name,
            userWeight: userWeight,
        });

        const logData = {
            userId,
            activityName: activity.name,
            durationValue: duration.value,
            intensityName: intensity.name,
            caloriesBurned: caloriesBurned,
            date: Timestamp.now(),
        };
        
        const activityLogsCollection = collection(db, `users/${userId}/activityLogs`);
        addDoc(activityLogsCollection, logData).catch((error) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: activityLogsCollection.path,
                    operation: 'create',
                    requestResourceData: logData
                }));
            } else {
                console.error("Error logging activity:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not log your activity." });
            }
        });
        
        toast({ title: "Success!", description: "Your activity has been logged." });
        form.reset();
        setCurrentStep(0);
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error in activity submission flow:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!userId) return;
    const docRef = doc(db, `users/${userId}/activityLogs`, logId);
    try {
        await deleteDoc(docRef);
        toast({ title: "Deleted", description: "Activity log has been removed." });
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete'
            }));
        } else {
            console.error("Error deleting log:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the log." });
        }
    }
  }

  const getActivityIcon = (activityName: string) => {
    const activity = activities.find(a => a.name === activityName);
    return activity?.iconUrl;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="flex items-center gap-2">
                    <Activity className="h-6 w-6 text-primary" />
                    Activity Tracker
                </CardTitle>
                <CardDescription>
                    Log your daily activities to keep track of your fitness routine.
                </CardDescription>
            </div>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Save className="mr-2 h-4 w-4"/> Log New Activity
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{steps[currentStep].title}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {currentStep === 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {activities.map(a => (
                                        <StepCard 
                                            key={a.id}
                                            label={a.name}
                                            icon={a.iconUrl ? <Image src={a.iconUrl} alt={a.name} width={32} height={32} /> : <Activity className="h-8 w-8 text-muted-foreground"/>}
                                            selected={watchActivityId === a.id}
                                            onClick={() => form.setValue('activityId', a.id)}
                                        />
                                    ))}
                                </div>
                            )}
                             {currentStep === 1 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {durations.map(d => (
                                        <StepCard 
                                            key={d.id}
                                            label={d.value}
                                            icon={<div className="text-2xl font-bold">{d.value.split(' ')[0]}<span className="text-sm text-muted-foreground ml-1">{d.value.split(' ')[1]}</span></div>}
                                            selected={watchDurationId === d.id}
                                            onClick={() => form.setValue('durationId', d.id)}
                                        />
                                    ))}
                                </div>
                            )}
                             {currentStep === 2 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {intensityLevels.map(i => (
                                        <StepCard 
                                            key={i.id}
                                            label={i.name}
                                            icon={<Flame className={cn("h-8 w-8", i.name === 'High' ? 'text-red-500' : i.name === 'Medium' ? 'text-orange-500' : 'text-green-500')} />}
                                            selected={watchIntensityId === i.id}
                                            onClick={() => form.setValue('intensityId', i.id)}
                                        />
                                    ))}
                                </div>
                            )}
                             <DialogFooter className="pt-4">
                                {currentStep > 0 && (
                                    <Button type="button" variant="outline" onClick={handlePrevStep}>
                                        <ArrowLeft className="mr-2 h-4 w-4"/> Previous
                                    </Button>
                                )}
                                {currentStep < steps.length - 1 ? (
                                    <Button type="button" onClick={handleNextStep}>
                                        Next <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                ) : (
                                     <Button type="submit" disabled={isSubmitting || !userWeight}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        Finish & Log
                                    </Button>
                                )}
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
             </Dialog>
          </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>My Activity History</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Intensity</TableHead>
                        <TableHead>Calories Burned</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                            </TableRow>
                        ))
                    ) : loggedActivities.length > 0 ? (
                        loggedActivities.map(log => {
                            const iconUrl = getActivityIcon(log.activityName);
                            return (
                                <TableRow key={log.id}>
                                    <TableCell>{format(log.date.toDate(), 'PPP')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {iconUrl ? (
                                                <Image src={iconUrl} alt={log.activityName} width={24} height={24} className="h-6 w-6" />
                                            ) : (
                                                <Activity className="h-5 w-5 text-muted-foreground" />
                                            )}
                                            {log.activityName}
                                        </div>
                                    </TableCell>
                                    <TableCell>{log.durationValue}</TableCell>
                                    <TableCell>{log.intensityName}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 font-medium">
                                            <Flame className="h-4 w-4 text-orange-500" />
                                            {log.caloriesBurned?.toFixed(0) ?? 'N/A'} kcal
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete this activity log.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(log.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">You haven't logged any activities yet.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
