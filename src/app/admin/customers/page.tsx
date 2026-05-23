
"use client";

import {
  File,
  PlusCircle,
  Trash2,
  Eye,
  Pencil,
  ArrowUpDown,
} from "lucide-react"
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  } from "@/components/ui/alert-dialog"
import { format } from "date-fns";
import { collection, getDocs, deleteDoc, doc, writeBatch, Timestamp, updateDoc, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input";
import { deleteCustomer } from "@/ai/flows/delete-customer-flow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type Plan = {
    id: string;
    name: string;
};

type Vendor = {
    id: string;
    name: string;
}

type Customer = {
    id:string;
    name: string;
    email: string;
    mobile?: string;
    planId: string;
    dietPlanId?: string;
    planName?: string;
    status: 'Active' | 'Inactive';
    paymentStatus?: 'Paid' | 'Failed' | 'Pending';
    since: string;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
    userId: string;
    isNew?: boolean;
    vendorId?: string;
}

type SortConfig = {
    key: keyof Customer;
    direction: 'ascending' | 'descending';
} | null;

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("all");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'subscriptionStartDate', direction: 'descending' });
    const { toast } = useToast();
    const { db } = useFirebase();
    const router = useRouter();

    const fetchInitialData = async () => {
        if (!db) return;
        try {
            const plansCollectionRef = collection(db, "subscriptionPlans");
            const vendorsCollectionRef = collection(db, "vendors");
            const customersCollectionRef = collection(db, "customers");
            
            const [plansData, vendorsData, customersData] = await Promise.all([
                getDocs(plansCollectionRef),
                getDocs(vendorsCollectionRef),
                getDocs(query(customersCollectionRef, orderBy("subscriptionStartDate", "desc")))
            ]);

            const activePlans = plansData.docs.map(doc => ({ id: doc.id, name: doc.data().name })) as Plan[];
            setPlans(activePlans);

            const fetchedVendors = vendorsData.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Vendor[];
            setVendors(fetchedVendors);

            const fetchedCustomers = customersData.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Customer[];
            
            const customersWithPlanNames = fetchedCustomers.map(customer => {
                const plan = activePlans.find(p => p.id === customer.planId);
                return {...customer, planName: plan?.name || "N/A" };
            });

            setCustomers(customersWithPlanNames);
        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch data." });
        }
    }
    
    useEffect(() => {
        if (db) {
            fetchInitialData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    const handleViewClick = async (customerId: string) => {
        if (!db) return;
        try {
            const customerDocRef = doc(db, "customers", customerId);
            await updateDoc(customerDocRef, { isNew: false });
            router.push(`/admin/customers/view/${customerId}`);
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Could not update customer status." });
        }
    };
    
    async function handleDeleteCustomer() {
        if (!customerToDelete) return;
        try {
            const result = await deleteCustomer({ userId: customerToDelete.id });
            if (result.success) {
                toast({ variant: "success", title: "Success", description: "Customer deleted successfully." });
                fetchInitialData();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: `Could not delete customer: ${error.message}` });
        } finally {
            setCustomerToDelete(null);
        }
    }

    async function deleteAllCustomers() {
        if (!db) return;
        try {
            const batch = writeBatch(db);
            const customersCollectionRef = collection(db, "customers");
            const profilesCollectionRef = collection(db, "userProfiles");
            
            customers.forEach(customer => {
                const customerDoc = doc(customersCollectionRef, customer.id);
                batch.delete(customerDoc);
                const profileDoc = doc(profilesCollectionRef, customer.id);
                batch.delete(profileDoc);
            });
            await batch.commit();
            toast({ variant: "success", title: "Success", description: "All customers deleted from database." });
            fetchInitialData();
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Could not delete all customers." });
        }
    }
    
    const requestSort = (key: keyof Customer) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const sortedAndFilteredCustomers = useMemo(() => {
        let sortableItems = [...customers];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key]! < b[sortConfig.key]!) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key]! > b[sortConfig.key]!) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        
        let filteredItems = sortableItems;

        // Filter by search query
        if(searchQuery) {
            filteredItems = filteredItems.filter(customer =>
                customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.mobile?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filter by vendor
        if(selectedVendor !== 'all') {
             filteredItems = filteredItems.filter(customer => customer.vendorId === selectedVendor);
        }

        return filteredItems;

    }, [customers, sortConfig, searchQuery, selectedVendor]);


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <div>
                <CardTitle>Customers</CardTitle>
                <CardDescription>
                Manage your customers and view their details.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                 <Input 
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64"
                />
                 <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors.map(vendor => (
                            <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
                <Link href="/admin/customers/add">
                    <Button size="sm" className="h-10 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Customer
                        </span>
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
              <TableHead className="px-0">
                 <Button variant="ghost" onClick={() => requestSort('name')} className="px-4 justify-start">
                    Customer
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="px-0">
                <Button variant="ghost" onClick={() => requestSort('subscriptionEndDate')} className="px-4 justify-start">
                    Expires On
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="px-0">
                <Button variant="ghost" onClick={() => requestSort('subscriptionStartDate')} className="px-4 justify-start">
                    Member Since
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredCustomers.length > 0 ? sortedAndFilteredCustomers.map(customer => (
                <TableRow key={customer.id}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        <span>{customer.name}</span>
                        {customer.isNew && <Badge>New</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{customer.mobile || customer.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{customer.planName}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={customer.status === 'Active' ? "success" : "secondary"}>{customer.status}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={customer.paymentStatus === 'Paid' ? 'success' : customer.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                        {customer.paymentStatus || 'N/A'}
                    </Badge>
                </TableCell>
                <TableCell>
                    {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}
                </TableCell>
                <TableCell>{customer.subscriptionStartDate ? format(customer.subscriptionStartDate.toDate(), "yyyy-MM-dd") : customer.since}</TableCell>
                <TableCell>
                   <TooltipProvider>
                    <div className="flex items-center justify-center gap-2">
                         <Tooltip>
                            <TooltipTrigger asChild>
                                 <Button variant="ghost" size="icon" onClick={() => handleViewClick(customer.id)}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View customer</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Customer</p>
                            </TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Link href={`/admin/customers/edit/${customer.id}`}>
                                    <Button variant="ghost" size="icon">
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Edit customer</span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Edit Customer</p>
                            </TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setCustomerToDelete(customer)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                            <span className="sr-only">Delete customer</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete Customer</p>
                                </TooltipContent>
                            </Tooltip>
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
                   </TooltipProvider>
                </TableCell>
              </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={7} className="text-center">No customers found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Mobile card grid */}
        <div className="grid gap-3 md:hidden">
          {sortedAndFilteredCustomers.length > 0 ? sortedAndFilteredCustomers.map(customer => (
            <Card key={customer.id} className="border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{customer.name}</span>
                      {customer.isNew && <Badge>New</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{customer.email}</div>
                    {customer.mobile && <div className="text-xs text-muted-foreground">{customer.mobile}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleViewClick(customer.id)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View customer</span>
                    </Button>
                    <Link href={`/admin/customers/edit/${customer.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit customer</span>
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setCustomerToDelete(customer)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete customer</span>
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
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline">{customer.planName}</Badge>
                  <Badge variant={customer.status === 'Active' ? "success" : "secondary"}>{customer.status}</Badge>
                  <Badge variant={customer.paymentStatus === 'Paid' ? 'success' : customer.paymentStatus === 'Failed' ? 'destructive' : 'secondary'}>
                    {customer.paymentStatus || 'N/A'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Expires: {customer.subscriptionEndDate ? format(customer.subscriptionEndDate.toDate(), 'PPP') : 'N/A'}</div>
                  <div>Member since: {customer.subscriptionStartDate ? format(customer.subscriptionStartDate.toDate(), "yyyy-MM-dd") : customer.since}</div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-center text-sm text-muted-foreground py-8">No customers found.</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>1-{sortedAndFilteredCustomers.length}</strong> of <strong>{customers.length}</strong>{" "}
          customers
        </div>
      </CardFooter>
    </Card>
    </>
  )
}
