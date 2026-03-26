
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type UpgradedCustomer = {
    id: string;
    customerName: string;
    planName: string;
}

export default function PartnerDashboardPage() {
    const [customerCount, setCustomerCount] = useState(0);
    const [upgradedCustomers, setUpgradedCustomers] = useState<UpgradedCustomer[]>([]);
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

                    // Fetch customer count
                    const customerQuery = query(collection(db, "customers"), where("vendorId", "==", user.uid));
                    const customerSnapshot = await getDocs(customerQuery);
                    setCustomerCount(customerSnapshot.size);
                    
                    // Fetch recent upgrades/renewals
                    const recentHistoryQuery = query(
                        collection(db, "subscriptionHistory"),
                        where("vendorId", "==", user.uid),
                        orderBy("purchaseDate", "desc"),
                        limit(5)
                    );
                     const recentHistorySnapshot = await getDocs(recentHistoryQuery);
                     
                     const customerIds = [...new Set(recentHistorySnapshot.docs.map(d => d.data().userId))];
                     const customersMap = new Map<string, string>();

                     if (customerIds.length > 0) {
                        const customerDocs = await getDocs(query(collection(db, 'customers'), where('__name__', 'in', customerIds)));
                        customerDocs.forEach(d => customersMap.set(d.id, d.data().name));
                     }
                     
                     const fetchedUpgrades = recentHistorySnapshot.docs.map(d => {
                         const data = d.data();
                         return {
                             id: d.id,
                             customerName: customersMap.get(data.userId) || "Unknown Customer",
                             planName: data.planName,
                         }
                     }) as UpgradedCustomer[];
                     setUpgradedCustomers(fetchedUpgrades);

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
                            <CardTitle>Recent Upgraded Customers</CardTitle>
                            <CardDescription>
                                Customers who recently renewed or upgraded.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Plan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : upgradedCustomers.length > 0 ? (
                                    upgradedCustomers.map(customer => (
                                        <TableRow key={customer.id}>
                                            <TableCell>
                                                <div className="font-medium">{customer.customerName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{customer.planName}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center">No recent upgrades.</TableCell>
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
