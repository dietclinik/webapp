
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

type Customer = {
  id: string;
  vendorId?: string;
}

type Vendor = {
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
  key: keyof Vendor;
  direction: "ascending" | "descending";
} | null;

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "ascending" });
  const { toast } = useToast();
  const { db } = useFirebase();

  useEffect(() => {
    const fetchVendorsAndCustomers = async () => {
        if (!db) return;
        try {
            const vendorsCollectionRef = collection(db, "vendors");
            const customersCollectionRef = collection(db, "customers");

            const [vendorSnapshot, customerSnapshot] = await Promise.all([
                getDocs(query(vendorsCollectionRef, orderBy("name", "asc"))),
                getDocs(customersCollectionRef)
            ]);
            
            const fetchedVendors = vendorSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Vendor[];
            const fetchedCustomers = customerSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Customer[];

            const customerCounts = new Map<string, number>();
            fetchedCustomers.forEach(customer => {
                if (customer.vendorId) {
                    customerCounts.set(customer.vendorId, (customerCounts.get(customer.vendorId) || 0) + 1);
                }
            });

            const vendorsWithCounts = fetchedVendors.map(vendor => ({
                ...vendor,
                customerCount: customerCounts.get(vendor.id) || 0
            }));
            
            setVendors(vendorsWithCounts);
        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch vendors and customer data." });
        }
    };
    
    if (db) {
      fetchVendorsAndCustomers();
    }
  }, [db, toast]);

  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;
    try {
        const vendorDocRef = doc(db, 'vendors', vendorToDelete.id);
        await deleteDoc(vendorDocRef);
        // Here you would also call a flow/function to delete the user from Auth
        toast({ variant: "success", title: "Success", description: "Vendor deleted successfully." });
        const updatedVendors = vendors.filter(v => v.id !== vendorToDelete.id);
        setVendors(updatedVendors);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: `Could not delete vendor: ${error.message}` });
    } finally {
        setVendorToDelete(null);
    }
  };

  const requestSort = (key: keyof Vendor) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredVendors = useMemo(() => {
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
      (vendor) =>
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vendors, sortConfig, searchQuery]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Vendors</CardTitle>
            <CardDescription>Manage your vendor vendors.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <Link href="/admin/vendors/add">
              <Button size="sm" className="h-10 gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Vendor</span>
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
                  Vendor Name
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
            {sortedAndFilteredVendors.length > 0 ? (
              sortedAndFilteredVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>
                      <div>{vendor.email}</div>
                      <div className="text-sm text-muted-foreground">{vendor.mobile}</div>
                  </TableCell>
                  <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{vendor.customerCount}</span>
                      </div>
                  </TableCell>
                   <TableCell>
                    <Badge variant={vendor.paymentStatus === 'Paid' ? 'success' : vendor.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                        {vendor.paymentStatus || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                     <Badge variant={vendor.status === 'Active' ? 'success' : 'secondary'}>
                        {vendor.status || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center justify-center gap-2">
                         <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/admin/vendors/view/${vendor.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View vendor</span>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>View Vendor</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/admin/vendors/edit/${vendor.id}`}>
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit vendor</span>
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Vendor</p></TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setVendorToDelete(vendor)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Delete vendor</span>
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Vendor</p></TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the vendor and its associated user account. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setVendorToDelete(null)}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteVendor}>Continue</AlertDialogAction>
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
                  No vendors found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Mobile card grid */}
        <div className="grid gap-3 md:hidden">
          {sortedAndFilteredVendors.length > 0 ? sortedAndFilteredVendors.map((vendor) => (
            <Card key={vendor.id} className="border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-semibold text-sm">{vendor.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{vendor.email}</div>
                    {vendor.mobile && <div className="text-xs text-muted-foreground">{vendor.mobile}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={`/admin/vendors/view/${vendor.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View vendor</span>
                      </Button>
                    </Link>
                    <Link href={`/admin/vendors/edit/${vendor.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit vendor</span>
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setVendorToDelete(vendor)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete vendor</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the vendor and its associated user account. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setVendorToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteVendor}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant={vendor.status === 'Active' ? 'success' : 'secondary'}>{vendor.status || 'N/A'}</Badge>
                  <Badge variant={vendor.paymentStatus === 'Paid' ? 'success' : vendor.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                    {vendor.paymentStatus || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{vendor.customerCount} customers</span>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-center text-sm text-muted-foreground py-8">No vendors found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
