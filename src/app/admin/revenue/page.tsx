
"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { IndianRupee, Calendar as CalendarIcon, ArrowUpRight, Users, Briefcase } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays, format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Transaction = {
  id: string;
  userId: string;
  customerName?: string;
  planName: string;
  amount: number;
  purchaseDate: Timestamp;
  isPartnerSubscription?: boolean;
};

type Customer = {
    id: string;
    name: string;
};

export default function RevenuePage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const { db } = useFirebase();

  useEffect(() => {
    if (!db) return;

    const fetchRevenueData = async () => {
      setLoading(true);
      try {
        const historyQuery = query(collection(db, "subscriptionHistory"), orderBy("purchaseDate", "desc"));
        const historySnapshot = await getDocs(historyQuery);
        
        const userIds = [...new Set(historySnapshot.docs.map(d => d.data().userId))];
        const usersMap = new Map<string, {name: string, isPartner: boolean}>();
        
        if (userIds.length > 0) {
            for (let i = 0; i < userIds.length; i += 30) {
                const batchIds = userIds.slice(i, i + 30);
                if (batchIds.length > 0) {
                    const [customerDetailsSnap, vendorDetailsSnap] = await Promise.all([
                        getDocs(query(collection(db, "customers"), where("__name__", "in", batchIds))),
                        getDocs(query(collection(db, "vendors"), where("__name__", "in", batchIds)))
                    ]);
                    
                    customerDetailsSnap.forEach(doc => {
                        usersMap.set(doc.id, { name: doc.data().name, isPartner: false });
                    });
                    vendorDetailsSnap.forEach(doc => {
                        usersMap.set(doc.id, { name: doc.data().name, isPartner: true });
                    });
                }
            }
        }
        
        const transactions = historySnapshot.docs.map(doc => {
            const data = doc.data();
            const userData = usersMap.get(data.userId);
            return {
                id: doc.id,
                ...data,
                customerName: userData?.name || 'Unknown User',
                isPartnerSubscription: userData?.isPartner || false
            } as Transaction;
        });
        
        setAllTransactions(transactions);
      } catch (error) {
        console.error("Error fetching revenue data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRevenueData();
  }, [db]);

  const filteredTransactions = useMemo(() => {
    if (!date?.from) return allTransactions;
    const fromDate = date.from;
    const toDate = date.to ? date.to : endOfMonth(date.from);
    
    return allTransactions.filter(t => {
        const purchaseDate = t.purchaseDate.toDate();
        return purchaseDate >= fromDate && purchaseDate <= toDate;
    })
  }, [allTransactions, date]);
  
  const { customerRevenue, partnerRevenue } = useMemo(() => {
      let customerRevenue = 0;
      let partnerRevenue = 0;
      filteredTransactions.forEach(t => {
          if (t.isPartnerSubscription) {
              partnerRevenue += t.amount;
          } else {
              customerRevenue += t.amount;
          }
      });
      return { customerRevenue, partnerRevenue };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      <CardHeader className="px-0">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <CardTitle className="text-3xl font-bold flex items-center gap-2"><ArrowUpRight className="h-8 w-8 text-primary"/> Revenue</CardTitle>
            <CardDescription>Track income from subscription plan sales.</CardDescription>
          </div>
           <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      
      <div className="grid gap-4 md:grid-cols-2">
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">General Customer Revenue</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">₹{customerRevenue.toLocaleString()}</div>}
             <p className="text-xs text-muted-foreground">From direct customer subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Subscription Revenue</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">₹{partnerRevenue.toLocaleString()}</div>}
             <p className="text-xs text-muted-foreground">From partners purchasing their own plans</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer / Partner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{format(t.purchaseDate.toDate(), 'PPP')}</TableCell>
                      <TableCell>{t.customerName}</TableCell>
                      <TableCell>{t.planName}</TableCell>
                      <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">No transactions found for the selected period.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {loading ? (
              [...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)
            ) : filteredTransactions.length > 0 ? (
              filteredTransactions.map(t => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{t.customerName}</p>
                        <p className="text-sm text-muted-foreground">{t.planName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(t.purchaseDate.toDate(), 'PPP')}</p>
                      </div>
                      <p className="font-bold text-primary shrink-0">₹{t.amount.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No transactions found for the selected period.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
