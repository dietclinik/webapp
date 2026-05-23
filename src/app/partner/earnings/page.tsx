

"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type EarningHistoryItem = {
    id: string;
    customerName: string;
    planName: string;
    purchaseDate: Timestamp;
    vendorEarning: number;
}

export default function PartnerEarningsPage() {
    const [earnings, setEarnings] = useState<EarningHistoryItem[]>([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [loading, setLoading] = useState(true);
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    const historyQuery = query(
                        collection(db, "subscriptionHistory"),
                        where("vendorId", "==", user.uid),
                        orderBy("purchaseDate", "desc")
                    );
                    const historySnap = await getDocs(historyQuery);
                    
                    const customerIds = [...new Set(historySnap.docs.map(d => d.data().userId))];
                    const customersMap = new Map<string, string>();

                    if (customerIds.length > 0) {
                        // Batch the requests to avoid hitting the 30-item limit for 'in' queries
                        for (let i = 0; i < customerIds.length; i += 30) {
                            const batchIds = customerIds.slice(i, i + 30);
                            const customerDetailsQuery = query(collection(db, "customers"), where("__name__", "in", batchIds));
                            const customerDetailsSnap = await getDocs(customerDetailsQuery);
                            customerDetailsSnap.forEach(doc => {
                                customersMap.set(doc.id, doc.data().name);
                            });
                        }
                    }

                    const earningsData = historySnap.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            customerName: customersMap.get(data.userId) || "Unknown Customer",
                            planName: data.planName,
                            purchaseDate: data.purchaseDate,
                            vendorEarning: data.vendorEarning || 0
                        } as EarningHistoryItem
                    });

                    setEarnings(earningsData);
                    const total = earningsData.reduce((acc, item) => acc + item.vendorEarning, 0);
                    setTotalEarnings(total);

                } catch (error) {
                    console.error("Error fetching earnings history:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [auth, db]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><IndianRupee className="h-6 w-6"/> Your Earnings</CardTitle>
                    <CardDescription>A complete history of your earnings from customer subscriptions.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="text-4xl font-bold">₹{totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                     <p className="text-sm text-muted-foreground">Total earnings</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Earnings History</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Table — md and above */}
                    <div className="overflow-x-auto hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : earnings.length > 0 ? (
                                earnings.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="whitespace-nowrap">{format(item.purchaseDate.toDate(), 'PP')}</TableCell>
                                        <TableCell>{item.customerName}</TableCell>
                                        <TableCell><Badge variant="outline">{item.planName}</Badge></TableCell>
                                        <TableCell className="text-right font-medium whitespace-nowrap">₹{item.vendorEarning.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">No earnings recorded yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>

                    {/* Cards — below md */}
                    <div className="grid gap-3 md:hidden">
                        {loading ? (
                            Array.from({length: 5}).map((_, i) => (
                                <div key={i} className="rounded-lg border p-4 space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))
                        ) : earnings.length > 0 ? (
                            earnings.map(item => (
                                <div key={item.id} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium">{item.customerName}</p>
                                            <p className="text-xs text-muted-foreground">{format(item.purchaseDate.toDate(), 'PP')}</p>
                                        </div>
                                        <p className="font-semibold text-sm shrink-0">₹{item.vendorEarning.toFixed(2)}</p>
                                    </div>
                                    <div className="mt-2">
                                        <Badge variant="outline">{item.planName}</Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-6">No earnings recorded yet.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    

    