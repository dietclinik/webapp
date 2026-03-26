
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, IndianRupee, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, Timestamp, doc, getDoc, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { startOfMonth, endOfMonth, format as formatDate, getYear } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Customer = {
    id: string;
    name: string;
    planId: string;
    paymentStatus?: 'Paid' | 'Failed' | 'Pending';
    subscriptionStartDate: Timestamp;
};

type Plan = {
    id: string;
    price: number;
    name?: string;
    vendorShareType?: 'percentage' | 'fixed';
    vendorShareValue?: number;
};

type MonthlyData = {
    name: string;
    earnings: number;
};

type UpgradedCustomer = {
    id: string;
    customerName: string;
    planName: string;
    purchaseDate: Timestamp;
}

export default function VendorDashboardPage() {
    const [customerCount, setCustomerCount] = useState(0);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [chartData, setChartData] = useState<MonthlyData[]>([]);
    const [upgradedCustomers, setUpgradedCustomers] = useState<UpgradedCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [vendorName, setVendorName] = useState("");
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
                        setVendorName(vendorDocSnap.data().name);
                    }

                    // Fetch customer count
                    const customerQuery = query(collection(db, "customers"), where("vendorId", "==", user.uid));
                    const customerSnapshot = await getDocs(customerQuery);
                    setCustomerCount(customerSnapshot.size);

                    // Fetch financial data
                    const historyQuery = query(collection(db, "subscriptionHistory"), where("vendorId", "==", user.uid));
                    const historySnapshot = await getDocs(historyQuery);
                    const historyDocs = historySnapshot.docs.map(d => d.data());
                    
                    const total = historyDocs.reduce((acc, curr) => acc + (curr.vendorEarning || 0), 0);
                    setTotalEarnings(total);

                    // Prepare chart data
                    const monthlyData: MonthlyData[] = [];
                    const now = new Date();
                    const currentYear = getYear(now);

                    for (let i = 0; i < 12; i++) {
                        const date = new Date(currentYear, i, 1);
                        const monthName = formatDate(date, 'MMM');
                        
                        const start = startOfMonth(date);
                        const end = endOfMonth(date);

                        const monthlyIncome = historyDocs
                            .filter(h => {
                                const purchaseDate = h.purchaseDate.toDate();
                                return purchaseDate >= start && purchaseDate <= end;
                            })
                            .reduce((acc, h) => acc + (h.vendorEarning || 0), 0);
                        
                        monthlyData.push({ name: monthName, earnings: monthlyIncome });
                    }
                    setChartData(monthlyData);
                    
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
                             purchaseDate: data.purchaseDate
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
    
      const chartConfig = {
          earnings: { label: "Earnings", color: "hsl(var(--primary))" },
      };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, {vendorName || 'Vendor'}!</CardTitle>
                    <CardDescription>Here's a quick overview of your customers and earnings.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
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
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                Total Earnings
                                </CardTitle>
                                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">₹{totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
                 <Card>
                    <CardHeader>
                        <CardTitle>Your Monthly Earnings</CardTitle>
                        <CardDescription>A summary of your earnings for the current year.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto">
                            {loading ? <Skeleton className="h-[350px] w-full" /> : (
                                <ChartContainer config={chartConfig} className="h-[350px] w-full min-w-[600px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`}/>
                                            <Tooltip 
                                                cursor={{fill: 'hsl(var(--muted))'}}
                                                content={<ChartTooltipContent 
                                                    formatter={(value) => `₹${Number(value).toLocaleString()}`}
                                                    indicator="dot" 
                                                />}
                                            />
                                            <Legend />
                                            <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
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
