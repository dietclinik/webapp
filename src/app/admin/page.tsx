
"use client";

import {
  Activity,
  ArrowUpRight,
  IndianRupee,
  Users,
  Receipt,
  Dumbbell,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { startOfMonth, endOfMonth, format as formatDate, getMonth, getYear } from 'date-fns';

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
import { useFirebase } from "@/components/firebase-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type Customer = {
    id: string;
    name: string;
    email: string;
    planId: string;
    planName?: string;
    since: string;
    status: 'Active' | 'Inactive';
    paymentStatus?: 'Paid' | 'Failed' | 'Pending';
    subscriptionStartDate: Timestamp;
};

type Plan = {
    id: string;
    name: string;
    price: number;
};

type Expense = {
    amount: number;
    date: Timestamp;
}

type DashboardStats = {
    totalRevenue: number;
    totalExpenses: number;
    subscriptions: number;
    activeCustomers: number;
    totalVendors: number;
};

type MonthlyData = {
    name: string;
    income: number;
    expense: number;
};


export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const { db } = useFirebase();

  useEffect(() => {
    if (!db) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            const plansCollectionRef = collection(db, "subscriptionPlans");
            const plansSnapshot = await getDocs(plansCollectionRef);
            const plans = plansSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Plan));
            const plansMap = new Map(plans.map(p => [p.id, p]));

            const customersCollectionRef = collection(db, "customers");
            const customersSnapshot = await getDocs(customersCollectionRef);
            const allCustomers = customersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer));
            
            const expensesCollectionRef = collection(db, "expenses");
            const expensesSnapshot = await getDocs(expensesCollectionRef);
            const allExpenses = expensesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Expense));

            const vendorsCollectionRef = collection(db, "vendors");
            const vendorsSnapshot = await getDocs(vendorsCollectionRef);
            const totalVendors = vendorsSnapshot.size;
            
            // Calculate totals for top cards
            const totalRevenue = allCustomers.reduce((acc, customer) => {
                 if (customer.paymentStatus !== 'Paid') return acc;
                 const plan = plansMap.get(customer.planId);
                 return acc + (plan?.price || 0);
            }, 0);
            const totalExpenses = allExpenses.reduce((acc, expense) => acc + expense.amount, 0);
            const subscriptions = allCustomers.length;
            const activeCustomers = allCustomers.filter(c => c.status === 'Active').length;
            setStats({ totalRevenue, totalExpenses, subscriptions, activeCustomers, totalVendors });

            // Prepare data for the current year chart
            const monthlyData: MonthlyData[] = [];
            const now = new Date();
            const currentYear = getYear(now);

            for (let i = 0; i < 12; i++) { // Loop for all 12 months
                const date = new Date(currentYear, i, 1);
                const monthName = formatDate(date, 'MMM');
                
                const start = startOfMonth(date);
                const end = endOfMonth(date);

                const monthlyIncome = allCustomers
                    .filter(c => {
                        if (c.paymentStatus !== 'Paid' || !c.subscriptionStartDate) return false;
                        const startDate = c.subscriptionStartDate.toDate();
                        return startDate >= start && startDate <= end;
                    })
                    .reduce((acc, c) => {
                         const plan = plansMap.get(c.planId);
                         return acc + (plan?.price || 0);
                    }, 0);

                const monthlyExpense = allExpenses
                    .filter(e => {
                        if (!e.date) return false;
                        const expenseDate = e.date.toDate();
                        return expenseDate >= start && expenseDate <= end;
                    })
                    .reduce((acc, e) => acc + e.amount, 0);
                
                monthlyData.push({ name: monthName, income: monthlyIncome, expense: monthlyExpense });
            }
            setChartData(monthlyData);

            // Fetch Recent Customers
            const recentQuery = query(customersCollectionRef, orderBy("subscriptionStartDate", "desc"), limit(5));
            const recentSnapshot = await getDocs(recentQuery);
            const fetchedRecentCustomers = recentSnapshot.docs.map(doc => {
                 const customerData = { ...doc.data(), id: doc.id } as Customer;
                 const plan = plansMap.get(customerData.planId);
                 return {...customerData, planName: plan?.name || "N/A" };
            });
            setRecentCustomers(fetchedRecentCustomers);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [db]);
  
  const chartConfig = {
      income: { label: "Income", color: "hsl(var(--primary))" },
      expense: { label: "Expense", color: "hsl(var(--destructive))" },
  };

  return (
    <div className="flex flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">₹{stats?.totalRevenue.toLocaleString() || '0.00'}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">₹{stats?.totalExpenses.toLocaleString() || '0.00'}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">+{stats?.subscriptions || 0}</div>}
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">+{stats?.totalVendors || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Customers
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">+{stats?.activeCustomers || 0}</div>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Recent Customers</CardTitle>
              <CardDescription>
                New customers that signed up this month.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/admin/customers">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({length: 5}).map((_, i) => (
                             <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                            </TableRow>
                        ))
                    ) : recentCustomers.length > 0 ? (
                        recentCustomers.map(customer => (
                            <TableRow key={customer.id}>
                                <TableCell>
                                    <div className="font-medium">{customer.name}</div>
                                    <div className="hidden text-sm text-muted-foreground md:inline">
                                        {customer.email}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{customer.planName}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{customer.subscriptionStartDate ? formatDate(customer.subscriptionStartDate.toDate(), "PPP") : 'N/A'}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center">No recent customers.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle>Income vs Expense Overview</CardTitle>
                <CardDescription>A summary of your financials for the current year.</CardDescription>
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
                                    <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
