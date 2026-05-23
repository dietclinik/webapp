

"use client";

import { PlusCircle, Pencil, Trash2, ArrowUpDown, Eye, Users } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileSearch } from "@/components/ui/mobile-search";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { deletePartner } from "@/ai/flows/delete-partner-flow";
import { errorEmitter } from "@/firebase/errors";
import { FirestorePermissionError } from "@/firebase/errors";

type Customer = {
  id: string;
  vendorId?: string;
}

type Partner = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  paymentStatus: 'Paid' | 'Failed' | 'Pending';
  customerCount?: number;
};

type SortConfig = {
  key: keyof Partner;
  direction: "ascending" | "descending";
} | null;

export default function PartnersPage() {
  const [vendors, setPartners] = useState<Partner[]>([]);
  const [vendorToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "ascending" });
  const { toast } = useToast();
  const { db } = useFirebase();

  const fetchPartnersAndCustomers = async () => {
    if (!db) return;
    try {
        const vendorsCollectionRef = collection(db, "vendors");
        const customersCollectionRef = collection(db, "customers");

        const [vendorSnapshot, customerSnapshot] = await Promise.all([
            getDocs(query(vendorsCollectionRef, orderBy("name", "asc"))),
            getDocs(customersCollectionRef)
        ]);
        
        const fetchedPartners = vendorSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Partner[];
        const fetchedCustomers = customerSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Customer[];

        const customerCounts = new Map<string, number>();
        fetchedCustomers.forEach(customer => {
            if (customer.vendorId) {
                customerCounts.set(customer.vendorId, (customerCounts.get(customer.vendorId) || 0) + 1);
            }
        });

        const partnersWithCounts = fetchedPartners.map(partner => ({
            ...partner,
            customerCount: customerCounts.get(partner.id) || 0
        }));
        
        setPartners(partnersWithCounts);
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: "vendors or customers",
                operation: 'list'
            }));
        } else {
            console.error("Error fetching data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch partners and customer data." });
        }
    }
  };

  useEffect(() => {
    if (db) {
      fetchPartnersAndCustomers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const handleDeletePartner = async () => {
    if (!vendorToDelete) return;
    try {
        const result = await deletePartner({ partnerId: vendorToDelete.id });
        if (result.success) {
            toast({ variant: "success", title: "Success", description: "Partner deleted successfully." });
            fetchPartnersAndCustomers();
        } else {
             throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: `Could not delete partner: ${error.message}` });
    } finally {
        setPartnerToDelete(null);
    }
  };

  const requestSort = (key: keyof Partner) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredPartners = useMemo(() => {
    let sortableItems = [...vendors];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] === undefined ? -1 : a[sortConfig.key];
        const valB = b[sortConfig.key] === undefined ? -1 : b[sortConfig.key];

        if (valA! < valB!) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (valA! > valB!) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems.filter(
      (partner) =>
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vendors, sortConfig, searchQuery]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Partners</CardTitle>
            <CardDescription>Manage your partners.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <MobileSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search partners..." className="w-64" />
            <Link href="/admin/partners/add">
              <Button size="sm" className="h-10 gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Partner</span>
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="overflow-x-auto hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => requestSort("name")} className="px-4 justify-start -ml-4">
                  Partner Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>
                 <Button variant="ghost" onClick={() => requestSort("customerCount")} className="px-4 justify-start -ml-4">
                  Customers Added
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredPartners.length > 0 ? (
              sortedAndFilteredPartners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell>
                      <div>{partner.email}</div>
                      <div className="text-sm text-muted-foreground">{partner.mobile}</div>
                  </TableCell>
                  <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{partner.customerCount}</span>
                      </div>
                  </TableCell>
                   <TableCell>
                    <Badge variant={partner.paymentStatus === 'Paid' ? 'success' : partner.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                        {partner.paymentStatus || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                     <Badge variant={partner.status === 'Active' ? 'success' : 'secondary'}>
                        {partner.status || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center justify-center gap-2">
                         <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/admin/partners/view/${partner.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View partner</span>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>View Partner</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/admin/partners/edit/${partner.id}`}>
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit partner</span>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Partner</p></TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setPartnerToDelete(partner)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Delete partner</span>
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Partner</p></TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the partner account and its associated user account. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPartnerToDelete(null)}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeletePartner}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No partners found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Mobile card grid */}
        <div className="grid gap-3 md:hidden">
          {sortedAndFilteredPartners.length > 0 ? sortedAndFilteredPartners.map((partner) => (
            <Card key={partner.id} className="border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-semibold text-sm">{partner.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{partner.email}</div>
                    {partner.mobile && <div className="text-xs text-muted-foreground">{partner.mobile}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={`/admin/partners/view/${partner.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View partner</span>
                      </Button>
                    </Link>
                    <Link href={`/admin/partners/edit/${partner.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit partner</span>
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setPartnerToDelete(partner)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete partner</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the partner account and its associated user account. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setPartnerToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeletePartner}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant={partner.status === 'Active' ? 'success' : 'secondary'}>{partner.status || 'N/A'}</Badge>
                  <Badge variant={partner.paymentStatus === 'Paid' ? 'success' : partner.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                    {partner.paymentStatus || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{partner.customerCount} customers</span>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-center text-sm text-muted-foreground py-8">No partners found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
