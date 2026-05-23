
"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, Timestamp, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Inactive';
  subscriptionEndDate?: Timestamp;
};

export default function MyCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
            const q = query(collection(db, "customers"), where("assignedStaffId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const fetchedCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            setCustomers(fetchedCustomers);
        } catch (error) {
            console.error("Error fetching assigned customers:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch your assigned customers. Check your connection or permissions." });
        } finally {
            setLoading(false);
        }
      } else {
        setCustomers([]);
        setLoading(false);
      }
    });

    return () => authUnsubscribe();
  }, [auth, db, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Assigned Customers</CardTitle>
        <CardDescription>Manage and monitor the progress of the customers assigned to you.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table — md and above */}
        <div className="overflow-x-auto hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscription Ends</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : customers.length > 0 ? (
              customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">{customer.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/staff/my-customers/view/${customer.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">You have no customers assigned.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Cards — below md */}
        <div className="grid gap-3 md:hidden">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : customers.length > 0 ? (
            customers.map(customer => (
              <div key={customer.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </div>
                  <Link href={`/staff/my-customers/view/${customer.id}`} className="shrink-0">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Ends: {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PP') : 'N/A'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-6">You have no customers assigned.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
