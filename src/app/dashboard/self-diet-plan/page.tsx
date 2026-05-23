
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PlusCircle, Pencil, Trash2, Search, X, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { collection, deleteDoc, doc, query, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type DailyLog = {
  id: string;
  date: Timestamp;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  dayName: string;
};

export default function SelfDietLogListPage() {
  const [dietLogs, setDietLogs] = useState<DailyLog[]>([]);
  const [logToDelete, setLogToDelete] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const { toast } = useToast();
  const { db, auth } = useFirebase();

  useEffect(() => {
    if (!auth || !db) return;
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setLoading(true);
        const q = query(collection(db, `users/${user.uid}/selfDietPlans`), orderBy("date", "desc"));
        const snapshotUnsubscribe = onSnapshot(q, (snap) => {
          const fetchedLogs = snap.docs.map(doc => {
            const d = doc.data();
            const totalCalories = d.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((f: number, item: any) => f + (Number(item.calories) || 0), 0), 0) || 0;
            const totalProtein  = d.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((f: number, item: any) => f + (Number(item.protein) || 0), 0), 0) || 0;
            const totalFat      = d.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((f: number, item: any) => f + (Number(item.fat) || 0), 0), 0) || 0;
            const totalCarbs    = d.meals?.reduce((acc: number, meal: any) => acc + meal.foodItems.reduce((f: number, item: any) => f + (Number(item.carbs) || 0), 0), 0) || 0;
            return { id: doc.id, date: d.date, dayName: d.day, totalCalories, totalProtein, totalFat, totalCarbs } as DailyLog;
          });
          setDietLogs(fetchedLogs);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching diet logs:", error);
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
    try {
      await deleteDoc(doc(db, `users/${userId}/selfDietPlans`, logToDelete.id));
      toast({ variant: "success", title: "Success", description: "Diet log deleted." });
    } catch {
      toast({ variant: 'destructive', title: "Error", description: "Could not delete diet log." });
    } finally {
      setLogToDelete(null);
    }
  }

  const filtered = useMemo(() => {
    return dietLogs.filter(log => {
      const logDate = log.date.toDate();
      if (fromDate && isBefore(logDate, startOfDay(fromDate))) return false;
      if (toDate && isAfter(logDate, endOfDay(toDate))) return false;
      if (search && !log.dayName.toLowerCase().includes(search.toLowerCase()) &&
          !format(logDate, 'PPP').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [dietLogs, search, fromDate, toDate]);

  const hasFilters = search || fromDate || toDate;

  const clearFilters = () => {
    setSearch("");
    setFromDate(undefined);
    setToDate(undefined);
  };

  const renderActions = (log: DailyLog) => (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/dashboard/self-diet-plan/builder?logId=${log.id}`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Edit Log</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setLogToDelete(log)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Delete Log</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this log?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your log for {log.date && format(log.date.toDate(), 'PPP')}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLogToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteLog}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle>My Daily Diet Logs</CardTitle>
            <CardDescription>Track and manage your daily food intake.</CardDescription>
          </div>
          <Link href="/dashboard/self-diet-plan/builder">
            <Button size="sm" className="h-8 gap-1 shrink-0">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Diet Log</span>
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by day name or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {/* From date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-40 justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fromDate ? format(fromDate, "PP") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
            </PopoverContent>
          </Popover>
          {/* To date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-40 justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {toDate ? format(toDate, "PP") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
            </PopoverContent>
          </Popover>
          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Calories (kcal)</TableHead>
                <TableHead>Protein (g)</TableHead>
                <TableHead>Fat (g)</TableHead>
                <TableHead>Carbs (g)</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered.length > 0 ? filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium whitespace-nowrap">{format(log.date.toDate(), 'PPP')}</TableCell>
                  <TableCell><Badge variant="outline">{log.dayName}</Badge></TableCell>
                  <TableCell className="font-semibold">{log.totalCalories.toFixed(0)}</TableCell>
                  <TableCell>{log.totalProtein.toFixed(1)}</TableCell>
                  <TableCell>{log.totalFat.toFixed(1)}</TableCell>
                  <TableCell>{log.totalCarbs.toFixed(1)}</TableCell>
                  <TableCell>{renderActions(log)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {hasFilters ? "No logs match your filters." : 'No diet logs found. Click "Add Diet Log" to get started!'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="grid gap-3 md:hidden">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))
          ) : filtered.length > 0 ? filtered.map(log => (
            <Card key={log.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{log.dayName}</p>
                    <p className="text-sm text-muted-foreground">{format(log.date.toDate(), 'PPP')}</p>
                  </div>
                  {renderActions(log)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calories:</span>
                    <span className="font-semibold">{log.totalCalories.toFixed(0)} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protein:</span>
                    <span className="font-semibold">{log.totalProtein.toFixed(1)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fat:</span>
                    <span className="font-semibold">{log.totalFat.toFixed(1)}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carbs:</span>
                    <span className="font-semibold">{log.totalCarbs.toFixed(1)}g</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-8 text-muted-foreground">
              {hasFilters ? "No logs match your filters." : 'No diet logs found. Click "Add Diet Log" to get started!'}
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Showing {filtered.length} of {dietLogs.length} log{dietLogs.length !== 1 ? 's' : ''}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
