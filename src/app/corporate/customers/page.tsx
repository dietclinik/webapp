
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Trash2, Eye } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, Timestamp, getDocs } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
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
import { useToast } from "@/hooks/use-toast";
import { deleteCustomer } from "@/ai/flows/delete-customer-flow";

type Customer = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: 'Active' | 'Inactive';
  subscriptionEndDate?: Timestamp;
};

export default function CorporateCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const fetchCustomers = async (userId: string) => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "customers"), where("corporateId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(fetchedCustomers);
    } catch (error) {
       console.error("Error fetching customers:", error);
       toast({ variant: 'destructive', title: "Error", description: `Could not fetch customers: ${(error as Error).message}` });
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    };
    
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchCustomers(user.uid);
      } else {
        setCustomers([]);
        setLoading(false);
      }
    });

    return () => authUnsubscribe();
  }, [auth, db, toast]);

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
        const result = await deleteCustomer({ userId: customerToDelete.id });
        if (result.success) {
            toast({ variant: "success", title: "Success", description: "Customer deleted successfully." });
            if (auth.currentUser) {
                fetchCustomers(auth.currentUser.uid);
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: `Could not delete customer: ${error.message}` });
    } finally {
        setCustomerToDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>My Customers</CardTitle>
                <CardDescription>
                View and manage the customers you have added for your event.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscription Ends</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : customers.length > 0 ? (
              customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                  </TableCell>
                   <TableCell>
                    <div className="text-sm">{customer.email}</div>
                    <div className="text-xs text-muted-foreground">{customer.mobile}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'}>{customer.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}
                  </TableCell>
                   <TableCell>
                        <div className="flex items-center justify-center gap-2">
                             <Link href={`/corporate/customers/view/${customer.id}`}>
                                <Button variant="ghost" size="icon">
                                    <Eye className="h-4 w-4" />
                                </Button>
                             </Link>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setCustomerToDelete(customer)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete {customer.name}'s data and authentication record.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteCustomer}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">You have not added any customers yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
