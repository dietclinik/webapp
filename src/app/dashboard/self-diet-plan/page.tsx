
"use client";

import {
  PlusCircle,
  Pencil,
  Trash2
} from "lucide-react"
import { useState, useEffect } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
} from "@/components/ui/alert-dialog"
import { collection, getDocs, deleteDoc, doc, query, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type DailyLog = {
    id: string;
    date: Timestamp;
    totalCalories: number;
    totalProtein: number;
    totalFat: number;
    totalCarbs: number;
    dayName: string;
}

export default function SelfDietLogListPage() {
  const [dietLogs, setDietLogs] = useState<DailyLog[]>([]);
  const [logToDelete, setLogToDelete] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const { toast } = useToast();
  const { db, auth } = useFirebase();

  useEffect(() => {
    if (!auth || !db) return;
    
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
        if(user) {
            setUserId(user.uid);
            setLoading(true);

            const dietLogsCollectionRef = collection(db, `users/${user.uid}/selfDietPlans`);
            const q = query(dietLogsCollectionRef, orderBy("date", "desc"));
            
            const snapshotUnsubscribe = onSnapshot(q, (querySnapshot) => {
                const fetchedLogs = querySnapshot.docs.map(doc => {
                    const docData = doc.data();
                    const totalCalories = docData.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.calories) || 0), 0), 0) || 0;
                    const totalProtein = docData.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.protein) || 0), 0), 0) || 0;
                    const totalFat = docData.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.fat) || 0), 0), 0) || 0;
                    const totalCarbs = docData.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.carbs) || 0), 0), 0) || 0;

                    return { 
                        id: doc.id,
                        date: docData.date,
                        dayName: docData.day,
                        totalCalories,
                        totalProtein,
                        totalFat,
                        totalCarbs
                     } as DailyLog
                });
                
                setDietLogs(fetchedLogs);
                setLoading(false);
            }, (error) => {
                 console.error("Error fetching diet logs: ", error);
                 toast({ variant: 'destructive', title: "Error", description: "Could not fetch your diet logs." });
                 setLoading(false);
            });

            return () => snapshotUnsubscribe();

        } else {
            setUserId(null);
            setDietLogs([]);
            setLoading(false);
        }
    });

    return () => authUnsubscribe();
  }, [auth, db, toast]);

  async function handleDeleteLog() {
    if (!db || !userId || !logToDelete) return;
    const logDoc = doc(db, `users/${userId}/selfDietPlans`, logToDelete.id);
    try {
        await deleteDoc(logDoc);
        toast({ variant: "success", title: "Success", description: "Diet log deleted." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete diet log." });
    } finally {
        setLogToDelete(null);
    }
  }

  const renderActions = (log: DailyLog) => (
     <TooltipProvider>
        <div className="flex items-center justify-center gap-2">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href={`/dashboard/self-diet-plan/builder?logId=${log.id}`}>
                    <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit Log</span>
                    </Button>
                    </Link>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Edit Log</p>
                </TooltipContent>
            </Tooltip>
            <AlertDialog>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setLogToDelete(log)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Delete Log</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Delete Log</p>
                    </TooltipContent>
                </Tooltip>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete your log for {format(log.date.toDate(), 'PPP')}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setLogToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLog}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        </TooltipProvider>
  )

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>My Daily Diet Logs</CardTitle>
                <CardDescription>
                Track and manage your daily food intake.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Link href="/dashboard/self-diet-plan/builder">
                    <Button size="sm" className="h-8 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Diet Log
                        </span>
                    </Button>
                </Link>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Day Name</TableHead>
              <TableHead>Total Calories</TableHead>
              <TableHead>Total Protein (g)</TableHead>
              <TableHead className="text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                    </TableRow>
                ))
            ) : dietLogs.length > 0 ? dietLogs.map(log => (
                <TableRow key={log.id}>
                <TableCell className="font-medium">{format(log.date.toDate(), 'PPP')}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.dayName}</Badge>
                </TableCell>
                <TableCell>{log.totalCalories.toFixed(0)}</TableCell>
                <TableCell>{log.totalProtein.toFixed(1)}</TableCell>
                <TableCell>
                  {renderActions(log)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No diet logs found. Click "Add Diet Log" to create one!</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Mobile Card View */}
        <div className="grid gap-4 md:hidden">
             {loading ? (
                [...Array(3)].map((_, i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                ))
            ) : dietLogs.length > 0 ? dietLogs.map(log => (
                <Card key={log.id}>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>{log.dayName}</span>
                            <span className="text-sm font-normal text-muted-foreground">{format(log.date.toDate(), 'PPP')}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Calories:</span>
                            <span className="font-semibold">{log.totalCalories.toFixed(0)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Protein:</span>
                            <span className="font-semibold">{log.totalProtein.toFixed(1)}g</span>
                        </div>
                    </CardContent>
                    <div className="p-4 pt-0 flex justify-end">
                         {renderActions(log)}
                    </div>
                </Card>
            )) : (
                 <div className="text-center py-8 text-muted-foreground">No diet logs found. Click "Add Diet Log" to create one!</div>
            )}
        </div>
      </CardContent>
    </Card>
    </>
  )
}
