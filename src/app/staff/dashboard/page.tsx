
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookCopy } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function StaffDashboardPage() {
    const [customerCount, setCustomerCount] = useState(0);
    const [planCount, setPlanCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    // Fetch assigned customers count
                    const customersQuery = query(collection(db, "customers"), where("assignedStaffId", "==", user.uid));
                    const customersSnapshot = await getDocs(customersQuery);
                    setCustomerCount(customersSnapshot.size);

                    // Fetch created diet plans count
                    const plansQuery = query(collection(db, "dietPlans"), where("createdBy", "==", user.uid));
                    const plansSnapshot = await getDocs(plansQuery);
                    setPlanCount(plansSnapshot.size);

                } catch (error) {
                    console.error("Error fetching dashboard data:", error);
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
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome to your Dashboard</CardTitle>
                    <CardDescription>Here's a quick overview of your assigned tasks and customers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                Assigned Customers
                                </CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{customerCount}</div>}
                                <p className="text-xs text-muted-foreground">
                                Active customers you manage
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                Diet Plans Created
                                </CardTitle>
                                <BookCopy className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{planCount}</div>}
                                <p className="text-xs text-muted-foreground">
                                Total diet plans you have created
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
