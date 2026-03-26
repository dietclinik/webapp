
"use client";

import {
  File,
  PlusCircle,
  Trash2,
  Eye,
  Pencil,
  ArrowUpDown,
  Download,
  Users,
} from "lucide-react"
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { deleteStaff } from "@/ai/flows/delete-staff-flow";

type Staff = {
    id:string;
    name: string;
    email: string;
    mobile?: string;
    experience: number;
    photoURL?: string;
    resumeURL?: string;
    assignedCustomerCount?: number;
}

type SortConfig = {
    key: keyof Staff;
    direction: 'ascending' | 'descending';
} | null;

type Customer = {
    id: string;
    assignedStaffId?: string;
};


export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
    const { toast } = useToast();
    const { db } = useFirebase();

    const fetchStaffAndCustomers = async () => {
        if (!db) return;
        try {
            const staffCollectionRef = collection(db, "staff");
            const customersCollectionRef = collection(db, "customers");
            
            const [staffSnapshot, customersSnapshot] = await Promise.all([
                getDocs(query(staffCollectionRef, orderBy("name", "asc"))),
                getDocs(customersCollectionRef)
            ]);

            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Staff[];
            const fetchedCustomers = customersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Customer[];

            const customerCounts = new Map<string, number>();
            fetchedCustomers.forEach(customer => {
                if (customer.assignedStaffId) {
                    customerCounts.set(customer.assignedStaffId, (customerCounts.get(customer.assignedStaffId) || 0) + 1);
                }
            });

            const staffWithCounts = fetchedStaff.map(s => ({
                ...s,
                assignedCustomerCount: customerCounts.get(s.id) || 0
            }));

            setStaff(staffWithCounts);
        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch staff and customer data." });
        }
    };

    useEffect(() => {
        if (db) {
            fetchStaffAndCustomers();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    async function handleDeleteStaff() {
        if (!staffToDelete) return;
        try {
            const result = await deleteStaff({ staffId: staffToDelete.id });
            if (result.success) {
                toast({ variant: "success", title: "Success", description: result.message });
                fetchStaffAndCustomers(); // Refetch all data
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: `Could not delete staff member: ${error.message}` });
        } finally {
            setStaffToDelete(null);
        }
    }
    
    const requestSort = (key: keyof Staff) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const sortedAndFilteredStaff = useMemo(() => {
        let sortableItems = [...staff];
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
        return sortableItems.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.mobile?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [staff, sortConfig, searchQuery]);


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <div>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>
                Manage your staff members and their details.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                 <Input 
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64"
                />
                <Link href="/admin/staff/add">
                    <Button size="sm" className="h-10 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Staff
                        </span>
                    </Button>
                </Link>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                 <Button variant="ghost" onClick={() => requestSort('name')} className="px-4 justify-start -ml-4">
                    Staff Member
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Assigned Customers</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead className="text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredStaff.length > 0 ? sortedAndFilteredStaff.map(s => (
                <TableRow key={s.id}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={s.photoURL} />
                            <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <span>{s.name}</span>
                            <div className="text-sm text-muted-foreground">{s.email}</div>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                  {s.mobile || 'N/A'}
                </TableCell>
                <TableCell>{s.experience} years</TableCell>
                 <TableCell>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{s.assignedCustomerCount}</span>
                    </div>
                 </TableCell>
                <TableCell>
                    {s.resumeURL ? (
                        <a href={s.resumeURL} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </a>
                    ) : 'Not provided'}
                </TableCell>
                <TableCell>
                   <TooltipProvider>
                    <div className="flex items-center justify-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link href={`/admin/staff/view/${s.id}`}>
                                    <Button variant="ghost" size="icon">
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">View staff</span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View Staff</p>
                            </TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                               <Link href={`/admin/staff/edit/${s.id}`}>
                                    <Button variant="ghost" size="icon">
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Edit staff</span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Edit Staff</p>
                            </TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setStaffToDelete(s)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                            <span className="sr-only">Delete staff</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete Staff</p>
                                </TooltipContent>
                            </Tooltip>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will permanently delete {s.name}'s data and authentication record. It will also unassign them from any customers. This cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setStaffToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteStaff}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                   </TooltipProvider>
                </TableCell>
              </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center">No staff found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>1-{sortedAndFilteredStaff.length}</strong> of <strong>{staff.length}</strong>{" "}
          staff members
        </div>
      </CardFooter>
    </Card>
    </>
  )
}
