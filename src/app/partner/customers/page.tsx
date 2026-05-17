
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Trash2, Eye, Pencil } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, Timestamp, getDocs, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toggleCustomerStatusByPartner } from "@/ai/flows/toggle-customer-status-by-partner-flow";
import { ShieldAlert } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: 'Active' | 'Inactive';
  subscriptionEndDate?: Timestamp;
};

type Plan = {
    id: string;
    maxCustomers?: number;
};

export default function PartnerCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [customerLimit, setCustomerLimit] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const activeCustomerCount = customers.filter(c => c.status === 'Active').length;
  const isLimitReached = customerLimit !== null && activeCustomerCount >= customerLimit;

  const fetchCustomersAndPlan = async (userId: string) => {
    if (!db) return;
    setLoading(true);
    try {
      const vendorDocRef = doc(db, 'vendors', userId);
      const vendorDoc = await getDoc(vendorDocRef);
      if (vendorDoc.exists()) {
          const vendorData = vendorDoc.data();
          // FITTBOSS partners have maxCustomers set directly.
          if (vendorData.maxCustomers) {
              setCustomerLimit(vendorData.maxCustomers);
          } else if (vendorData.planId) {
              const planDocRef = doc(db, 'subscriptionPlans', vendorData.planId);
              const planDoc = await getDoc(planDocRef);
              if(planDoc.exists()){
                  setCustomerLimit(planDoc.data().maxCustomers || null);
              }
          } else {
              setCustomerLimit(0);
          }
      }

      const q = query(collection(db, "customers"), where("vendorId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      
      const updatedCustomers = await Promise.all(fetchedCustomers.map(async (customer) => {
        if (customer.status === 'Active' && customer.subscriptionEndDate && customer.subscriptionEndDate.toDate() < new Date()) {
          const customerDocRef = doc(db, 'customers', customer.id);
          await updateDoc(customerDocRef, { status: 'Inactive' });
          return { ...customer, status: 'Inactive' as 'Inactive' };
        }
        return customer;
      }));
      
      setCustomers(updatedCustomers);
    } catch (error) {
       console.error("Error fetching data:", error);
       toast({ variant: 'destructive', title: "Error", description: `Could not fetch data: ${(error as Error).message}` });
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
      setCurrentUser(user);
      if (user) {
        fetchCustomersAndPlan(user.uid);
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
                fetchCustomersAndPlan(auth.currentUser.uid);
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
  
  const handleToggleStatus = async (customer: Customer) => {
    const { id: customerId, status: currentStatus, subscriptionEndDate } = customer;
    
    // Allow toggling only if the subscription is already expired
    if (currentStatus === 'Active' && subscriptionEndDate && subscriptionEndDate.toDate() > new Date()) {
      toast({
        variant: "destructive",
        title: "Action Restricted",
        description: "You can only deactivate a customer after their subscription expires.",
      });
      return;
    }

    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    
    if (newStatus === 'Active' && isLimitReached) {
        toast({
            variant: "destructive",
            title: "Customer Limit Reached",
            description: "You cannot activate more customers. Please upgrade your plan."
        });
        return;
    }

    try {
      await toggleCustomerStatusByPartner({ customerId, newStatus });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: newStatus } : c));
      toast({ variant: 'success', title: 'Status Updated', description: `Customer has been set to ${newStatus}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Could not update status: ${error.message}` });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
                <CardTitle>My Customers</CardTitle>
                <CardDescription>
                View and manage the customers you have added. You have {activeCustomerCount} active customers out of {customerLimit ?? 'unlimited'}.
                </CardDescription>
            </div>
            <Link href="/partner/customers/add" className={isLimitReached ? 'pointer-events-none shrink-0' : 'shrink-0'}>
                <Button size="sm" className="h-8 gap-1" disabled={isLimitReached}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Add Customer
                    </span>
                </Button>
            </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLimitReached && (
            <Alert variant="destructive" className="mb-4">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                    You have reached your customer limit. To add more customers, please upgrade your plan.
                     <Button asChild variant="outline" size="sm">
                        <Link href="/partner/subscription">Upgrade Plan</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        )}
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Subscription Ends</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : customers.length > 0 ? (
              customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{customer.mobile}</div>
                  </TableCell>
                   <TableCell className="hidden sm:table-cell">
                    <div className="text-sm">{customer.email}</div>
                    <div className="text-xs text-muted-foreground">{customer.mobile}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={customer.status === 'Active'}
                            onCheckedChange={() => handleToggleStatus(customer)}
                            disabled={(customer.status === 'Inactive' && isLimitReached) || (customer.status === 'Active' && customer.subscriptionEndDate && customer.subscriptionEndDate.toDate() > new Date())}
                        />
                        <Badge variant={customer.status === 'Active' ? 'success' : 'secondary'} className="hidden xs:inline-flex">{customer.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}
                  </TableCell>
                   <TableCell>
                        <div className="flex items-center justify-center gap-2">
                             <Link href={`/partner/customers/view/${customer.id}`}>
                                <Button variant="ghost" size="icon">
                                    <Eye className="h-4 w-4" />
                                </Button>
                             </Link>
                             <Link href={`/partner/customers/edit/${customer.id}`}>
                                <Button variant="ghost" size="icon">
                                    <Pencil className="h-4 w-4" />
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
        </div>
      </CardContent>
    </Card>
  )
}
