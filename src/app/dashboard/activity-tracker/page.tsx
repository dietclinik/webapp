
"use client";

import { useState, useEffect } from "react";
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, Plus, Trash2, Flame } from "lucide-react";
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

const intensityColor = (name: string) =>
  name === 'High' ? 'text-red-500' : name === 'Medium' ? 'text-orange-500' : 'text-green-500';

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

  const { settings } = useSettings();
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof activityLogSchema>>({
    resolver: zodResolver(activityLogSchema),
    defaultValues: { activityId: '', durationId: '', intensityId: '' },
  });

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
        if (profileSnap.exists()) {
          setUserWeight(Number(profileSnap.data().weight));
        }
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: profileDocRef.path, operation: 'get' }));
        } else {
          console.error("Could not fetch user weight.", e);
        }
      }
    };
    fetchInitialData();

    const q = query(
      collection(db, `users/${userId}/activityLogs`),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
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
        caloriesBurned,
        date: Timestamp.now(),
      };

      const activityLogsCollection = collection(db, `users/${userId}/activityLogs`);
      addDoc(activityLogsCollection, logData).catch((error) => {
        if (error.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: activityLogsCollection.path,
            operation: 'create',
            requestResourceData: logData,
          }));
        } else {
          console.error("Error logging activity:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not log your activity." });
        }
      });

      toast({ title: "Success!", description: "Your activity has been logged." });
      form.reset();
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
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
      } else {
        console.error("Error deleting log:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the log." });
      }
    }
  };

  const getActivityIcon = (activityName: string) =>
    activities.find(a => a.name === activityName)?.iconUrl;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Activity Tracker
              </CardTitle>
              <CardDescription>
                Log your daily activities to keep track of your fitness routine.
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) form.reset(); }}>
              <DialogTrigger asChild>
                <Button className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" /> Log Activity
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Log New Activity</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
                    <FormField
                      control={form.control}
                      name="activityId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Activity</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an activity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {activities.map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  <div className="flex items-center gap-2">
                                    {a.iconUrl ? (
                                      <Image src={a.iconUrl} alt={a.name} width={18} height={18} className="rounded" />
                                    ) : (
                                      <Activity className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    {a.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="durationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {durations.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="intensityId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intensity</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select intensity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {intensityLevels.map(i => (
                                <SelectItem key={i.id} value={i.id}>
                                  <div className="flex items-center gap-2">
                                    <Flame className={cn("h-4 w-4", intensityColor(i.name))} />
                                    {i.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!userWeight && (
                      <p className="text-sm text-destructive">
                        Please set your weight in your profile before logging activities.
                      </p>
                    )}

                    <DialogFooter>
                      <Button type="submit" className="w-full" disabled={isSubmitting || !userWeight}>
                        {isSubmitting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</>
                        ) : (
                          <><Flame className="mr-2 h-4 w-4" /> Log Activity</>
                        )}
                      </Button>
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
          {/* Desktop table */}
          <div className="hidden md:block">
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
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Flame className={cn("h-4 w-4", intensityColor(log.intensityName))} />
                            {log.intensityName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-medium">
                            <Flame className="h-4 w-4 text-orange-500" />
                            {log.caloriesBurned?.toFixed(0) ?? 'N/A'} kcal
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteButton onDelete={() => handleDelete(log.id)} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      You haven't logged any activities yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))
            ) : loggedActivities.length > 0 ? (
              loggedActivities.map(log => {
                const iconUrl = getActivityIcon(log.activityName);
                return (
                  <div key={log.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {iconUrl ? (
                          <Image src={iconUrl} alt={log.activityName} width={32} height={32} className="h-8 w-8 rounded" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{log.activityName}</p>
                        <p className="text-xs text-muted-foreground">{format(log.date.toDate(), 'PPP')}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-xs">{log.durationValue}</Badge>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Flame className={cn("h-3 w-3", intensityColor(log.intensityName))} />
                            {log.intensityName}
                          </Badge>
                          <span className="text-xs font-medium text-orange-500 flex items-center gap-0.5">
                            <Flame className="h-3 w-3" />
                            {log.caloriesBurned?.toFixed(0) ?? 'N/A'} kcal
                          </span>
                        </div>
                      </div>
                    </div>
                    <DeleteButton onDelete={() => handleDelete(log.id)} />
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                You haven't logged any activities yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
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
          <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
