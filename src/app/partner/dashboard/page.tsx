

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Customer = {
    id: string;
    name: string;
    planId: string;
    subscriptionStartDate: Timestamp;
    planName?: string;
};

export default function PartnerDashboardPage() {
    const [customerCount, setCustomerCount] = useState(0);
    const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [partnerName, setPartnerName] = useState("");
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) {
            setLoading(false);
            return;
        }

        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    const vendorDocRef = doc(db, 'vendors', user.uid);
                    const vendorDocSnap = await getDoc(vendorDocRef);
                    if (vendorDocSnap.exists()) {
                        setPartnerName(vendorDocSnap.data().name);
                    }

                    // Fetch all customers to get the count
                    const customerQuery = query(collection(db, "customers"), where("vendorId", "==", user.uid));
                    const customerSnapshot = await getDocs(customerQuery);
                    setCustomerCount(customerSnapshot.size);
                    
                    // Fetch recent customers
                    const recentCustomerQuery = query(
                        collection(db, "customers"),
                        where("vendorId", "==", user.uid),
                        orderBy("subscriptionStartDate", "desc"),
                        limit(5)
                    );
                     const recentCustomerSnapshot = await getDocs(recentCustomerQuery);

                     const planIds = [...new Set(recentCustomerSnapshot.docs.map(d => d.data().planId))];
                     const plansMap = new Map<string, string>();
                     if (planIds.length > 0) {
                         const planDocs = await getDocs(query(collection(db, 'subscriptionPlans'), where('__name__', 'in', planIds)));
                         planDocs.forEach(d => plansMap.set(d.id, d.data().name));
                     }
                     
                     const fetchedRecentCustomers = recentCustomerSnapshot.docs.map(d => {
                         const data = d.data();
                         return {
                             id: d.id,
                             name: data.name,
                             planId: data.planId,
                             subscriptionStartDate: data.subscriptionStartDate,
                             planName: plansMap.get(data.planId) || 'N/A'
                         }
                     }) as Customer[];
                     setRecentCustomers(fetchedRecentCustomers);

                } catch (error) {
                    console.error("Error fetching dashboard data:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => authUnsubscribe();
    }, [auth, db]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, {partnerName || 'Partner'}!</CardTitle>
                    <CardDescription>Here's a quick overview of your customers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                Total Customers
                                </CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{customerCount}</div>}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
                <Card>
                    <CardHeader className="flex flex-row items-center">
                        <div className="grid gap-2">
                            <CardTitle>Recently Added Customers</CardTitle>
                            <CardDescription>
                                The newest customers you've added.
                            </CardDescription>
                        </div>
                        <Button asChild size="sm" className="ml-auto gap-1">
                            <Link href="/partner/customers">
                                View All
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Date Added</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : recentCustomers.length > 0 ? (
                                    recentCustomers.map(customer => (
                                        <TableRow key={customer.id}>
                                            <TableCell>
                                                <div className="font-medium">{customer.name}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{customer.planName}</Badge>
                                            </TableCell>
                                                <TableCell>
                                                {format(customer.subscriptionStartDate.toDate(), 'PPP')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">No recent customers added.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    