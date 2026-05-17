
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, Timestamp, getDocs, doc, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Eye, Search, ArrowUpDown } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExpiredCustomer = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  planName: string;
  vendorId?: string;
  vendorName?: string;
  subscriptionEndDate: Timestamp;
};

type Vendor = { id: string; name: string };

type SortKey = "name" | "subscriptionEndDate" | "daysExpired";
type SortDir = "asc" | "desc";

function DaysExpiredBadge({ days }: { days: number }) {
  if (days <= 7) return <Badge variant="outline" className="border-yellow-500 text-yellow-600">{days}d ago</Badge>;
  if (days <= 30) return <Badge variant="outline" className="border-orange-500 text-orange-600">{days}d ago</Badge>;
  return <Badge variant="destructive">{days}d ago</Badge>;
}

export default function AdminRenewalClientsPage() {
  const [customers, setCustomers] = useState<ExpiredCustomer[]>([]);
  const [filtered, setFiltered] = useState<ExpiredCustomer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("subscriptionEndDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { db } = useFirebase();
  const { toast } = useToast();

  const now = new Date();

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const [customersSnap, vendorsSnap] = await Promise.all([
          getDocs(query(collection(db, "customers"), where("subscriptionEndDate", "<", Timestamp.fromDate(now)))),
          getDocs(collection(db, "vendors")),
        ]);

        const vendorMap: Record<string, string> = {};
        const vendorList: Vendor[] = [];
        vendorsSnap.docs.forEach((d) => {
          vendorMap[d.id] = d.data().name ?? d.id;
          vendorList.push({ id: d.id, name: d.data().name ?? d.id });
        });
        setVendors(vendorList.sort((a, b) => a.name.localeCompare(b.name)));

        const planCache: Record<string, string> = {};
        const fetchedCustomers: ExpiredCustomer[] = await Promise.all(
          customersSnap.docs.map(async (d) => {
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
            return {
              id: d.id,
              name: data.name ?? "",
              email: data.email ?? "",
              mobile: data.mobile ?? "",
              planName,
              vendorId: data.vendorId ?? null,
              vendorName: data.vendorId ? (vendorMap[data.vendorId] ?? "Unknown Partner") : "Direct",
              subscriptionEndDate: data.subscriptionEndDate,
            } as ExpiredCustomer;
          })
        );

        setCustomers(fetchedCustomers);
        setFiltered(fetchedCustomers);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: `Could not fetch data: ${error.message}` });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db]);

  useEffect(() => {
    let list = [...customers];

    if (vendorFilter !== "all") {
      if (vendorFilter === "direct") {
        list = list.filter((c) => !c.vendorId);
      } else {
        list = list.filter((c) => c.vendorId === vendorFilter);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.mobile.includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "subscriptionEndDate")
        cmp = a.subscriptionEndDate.toMillis() - b.subscriptionEndDate.toMillis();
      else if (sortKey === "daysExpired")
        cmp = a.subscriptionEndDate.toMillis() - b.subscriptionEndDate.toMillis();
      return sortDir === "asc" ? cmp : -cmp;
    });

    setFiltered(list);
  }, [search, vendorFilter, customers, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Renewal Clients</CardTitle>
              <CardDescription>
                All customers whose subscriptions have expired — {customers.length} total.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Filter by partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                <SelectItem value="direct">Direct (No Partner)</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Customer <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("subscriptionEndDate")}>
                    Expired On <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("daysExpired")}>
                    Days Expired <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
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
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{customer.vendorName}</span>
                      </TableCell>
                      <TableCell>{format(expiredOn, "PPP")}</TableCell>
                      <TableCell>
                        <DaysExpiredBadge days={daysAgo} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/admin/customers/view/${customer.id}`}>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search || vendorFilter !== "all"
                      ? "No customers match your filters."
                      : "No expired customers found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
