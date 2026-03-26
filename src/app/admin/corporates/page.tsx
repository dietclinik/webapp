
"use client";

import { PlusCircle, Search, Users, Pencil, Trash2 } from "lucide-react";
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
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type Customer = {
  id: string;
  corporateId?: string;
}

type Corporate = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  customerCount?: number;
};

export default function AllCorporatesPage() {
  const [corporates, setCorporates] = useState<Corporate[]>([]);
  const [corporateToDelete, setCorporateToDelete] = useState<Corporate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { db } = useFirebase();

  const fetchCorporatesAndCustomers = async () => {
    if (!db) return;
    try {
        const corporatesCollectionRef = collection(db, "corporates");
        const customersCollectionRef = collection(db, "customers");

        const [corporateSnapshot, customerSnapshot] = await Promise.all([
            getDocs(query(corporatesCollectionRef, orderBy("name", "asc"))),
            getDocs(customersCollectionRef)
        ]);
        
        const fetchedCorporates = corporateSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Corporate[];
        const fetchedCustomers = customerSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Customer[];

        const customerCounts = new Map<string, number>();
        fetchedCustomers.forEach(customer => {
            if (customer.corporateId) {
                customerCounts.set(customer.corporateId, (customerCounts.get(customer.corporateId) || 0) + 1);
            }
        });

        const corporatesWithCounts = fetchedCorporates.map(corporate => ({
            ...corporate,
            customerCount: customerCounts.get(corporate.id) || 0
        }));
        
        setCorporates(corporatesWithCounts);
    } catch (error: any) {
         if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: "corporates or customers",
                operation: 'list'
            }));
        } else {
            console.error("Error fetching data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch corporates and customer data." });
        }
    }
  };

  useEffect(() => {
    if (db) {
      fetchCorporatesAndCustomers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const handleDeleteCorporate = async () => {
    if (!corporateToDelete || !db) return;
    try {
        const corporateDocRef = doc(db, 'corporates', corporateToDelete.id);
        await deleteDoc(corporateDocRef);
        // TODO: Add flow to delete auth user
        toast({ variant: "success", title: "Success", description: "Corporate account deleted successfully." });
        fetchCorporatesAndCustomers();
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `corporates/${corporateToDelete.id}`,
                operation: 'delete'
            }));
        } else {
            toast({ variant: 'destructive', title: "Error", description: `Could not delete corporate account: ${error.message}` });
        }
    } finally {
        setCorporateToDelete(null);
    }
  };

  const filteredCorporates = useMemo(() => {
    return corporates.filter(
      (corporate) =>
        corporate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        corporate.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [corporates, searchQuery]);
  

  return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <CardTitle>All Corporate Partners</CardTitle>
                    <CardDescription>Manage all your corporate partners.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                        type="search"
                        placeholder="Search corporates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 pl-8"
                        />
                    </div>
                    <Link href="/admin/corporates/add">
                    <Button size="sm" className="h-10 gap-1">
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Corporate</span>
                    </Button>
                    </Link>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Corporate Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                 <TableBody>
                    {filteredCorporates.length > 0 ? (
                        filteredCorporates.map((corporate) => (
                            <TableRow key={corporate.id}>
                                <TableCell className="font-medium">{corporate.name}</TableCell>
                                <TableCell>
                                    <div>{corporate.email}</div>
                                    <div className="text-sm text-muted-foreground">{corporate.mobile}</div>
                                </TableCell>
                                <TableCell>{corporate.customerCount}</TableCell>
                                <TableCell>
                                    <Badge variant={corporate.status === 'Active' ? 'success' : 'secondary'}>
                                        {corporate.status || 'N/A'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <TooltipProvider>
                                        <div className="flex items-center justify-end gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                <Link href={`/admin/corporates/view/${corporate.id}`}>
                                                    <Button variant="ghost" size="icon">
                                                        <Users className="h-4 w-4" />
                                                        <span className="sr-only">View Customers & Details</span>
                                                    </Button>
                                                </Link>
                                                </TooltipTrigger>
                                                <TooltipContent><p>View Customers & Details</p></TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                <Link href={`/admin/corporates/edit/${corporate.id}`}>
                                                    <Button variant="ghost" size="icon">
                                                        <Pencil className="h-4 w-4" />
                                                        <span className="sr-only">Edit corporate</span>
                                                    </Button>
                                                </Link>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Edit Corporate</p></TooltipContent>
                                            </Tooltip>
                                            <AlertDialog>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => setCorporateToDelete(corporate)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                        <span className="sr-only">Delete corporate</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Delete Corporate</p></TooltipContent>
                                            </Tooltip>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete the corporate account and its associated user account. This action cannot be undone.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setCorporateToDelete(null)}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteCorporate}>Continue</AlertDialogAction>
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
                            <TableCell colSpan={5} className="text-center py-12">
                                No corporate partners found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
