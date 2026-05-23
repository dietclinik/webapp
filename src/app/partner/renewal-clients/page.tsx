
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, Timestamp, getDocs, doc, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Eye } from "lucide-react";
import { MobileSearch } from "@/components/ui/mobile-search";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ExpiredCustomer = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  planId?: string;
  planName?: string;
  subscriptionEndDate: Timestamp;
};

function DaysExpiredBadge({ days }: { days: number }) {
  if (days <= 7) return <Badge variant="outline" className="border-yellow-500 text-yellow-600">{days}d ago</Badge>;
  if (days <= 30) return <Badge variant="outline" className="border-orange-500 text-orange-600">{days}d ago</Badge>;
  return <Badge variant="destructive">{days}d ago</Badge>;
}

export default function PartnerRenewalClientsPage() {
  const [customers, setCustomers] = useState<ExpiredCustomer[]>([]);
  const [filtered, setFiltered] = useState<ExpiredCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const now = new Date();

  const fetchExpiredCustomers = async (userId: string) => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "customers"),
        where("vendorId", "==", userId),
        where("subscriptionEndDate", "<", Timestamp.fromDate(now))
      );
      const snapshot = await getDocs(q);

      const planCache: Record<string, string> = {};
      const fetchedCustomers: ExpiredCustomer[] = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data();
          let planName = "N/A";
          if (data.planId) {
            if (planCache[data.planId]) {
              planName = planCache[data.planId];
            } else {
              const planSnap = await getDoc(doc(db, "subscriptionPlans", data.planId));
              planName = planSnap.exists() ? planSnap.data().name : "N/A";
              planCache[data.planId] = planName;
            }
          }
          return { id: d.id, ...data, planName } as ExpiredCustomer;
        })
      );

      fetchedCustomers.sort(
        (a, b) => b.subscriptionEndDate.toMillis() - a.subscriptionEndDate.toMillis()
      );

      setCustomers(fetchedCustomers);
      setFiltered(fetchedCustomers);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: `Could not fetch expired customers: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth || !db) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) fetchExpiredCustomers(user.uid);
      else { setLoading(false); }
    });
    return () => unsub();
  }, [auth, db]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.mobile.includes(q)
      )
    );
  }, [search, customers]);

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Renewal Clients</CardTitle>
              <CardDescription>
                Customers whose subscriptions have expired — {customers.length} total.
              </CardDescription>
            </div>
            <MobileSearch value={search} onChange={setSearch} placeholder="Search by name, email, mobile..." />
          </div>
        </CardHeader>
        <CardContent>
          {/* Table — md and above */}
          <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Expired On</TableHead>
                <TableHead>Days Expired</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((customer) => {
                  const expiredOn = customer.subscriptionEndDate.toDate();
                  const daysAgo = differenceInDays(now, expiredOn);
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{customer.email}</div>
                        <div className="text-xs text-muted-foreground">{customer.mobile}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.planName}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{format(expiredOn, "PP")}</TableCell>
                      <TableCell>
                        <DaysExpiredBadge days={daysAgo} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/partner/customers/view/${customer.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>View Profile</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {search ? "No customers match your search." : "No expired customers found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Cards — below md */}
          <div className="grid gap-3 md:hidden">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((customer) => {
                const expiredOn = customer.subscriptionEndDate.toDate();
                const daysAgo = differenceInDays(now, expiredOn);
                return (
                  <div key={customer.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.mobile}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <DaysExpiredBadge days={daysAgo} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/partner/customers/view/${customer.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>View Profile</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{customer.planName}</Badge>
                      <span>Expired: {format(expiredOn, "PP")}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-6">
                {search ? "No customers match your search." : "No expired customers found."}
              </p>
            )}
          </div>

          {!loading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing {filtered.length} of {customers.length} expired customer{customers.length !== 1 ? "s" : ""}.
            </p>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
