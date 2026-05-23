
"use client";

import {
  PlusCircle,
  Pencil,
  Trash2,
  Users
} from "lucide-react"
import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { collection, getDocs, deleteDoc, doc, updateDoc, writeBatch, serverTimestamp, addDoc, query, orderBy, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input";
// WhatsApp messages are now sent via API route
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { sendTransactionalEmail } from "@/ai/flows/send-transactional-email-flow";

type DietPlan = {
  id: string;
  name: string;
  target: string;
  created: string;
  createdBy?: string;
  createdByName?: string;
}

type Customer = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  dietPlanId?: string;
};

type UserInfo = {
  id: string;
  name: string;
}

export default function DietPlansPage() {
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [planToAssign, setPlanToAssign] = useState<DietPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<DietPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const form = useForm();

  const fetchPlansAndUsers = async () => {
    if (!db || !auth?.currentUser) return;
    const adminId = auth.currentUser.uid;

    try {
      // Fetch all staff users to map createdBy id to name
      const staffSnapshot = await getDocs(collection(db, "staff"));
      const staffList = staffSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })) as UserInfo[];
      setUsers(staffList);
      const userMap = new Map(staffList.map(u => [u.id, u.name]));
      if (auth.currentUser.displayName) {
        userMap.set(adminId, auth.currentUser.displayName);
      }

      // Fetch diet plans
      const dietPlansRef = collection(db, "dietPlans");
      const staffIds = staffList.map(s => s.id);
      const planPromises: Promise<any>[] = [];

      // Plans created by admin
      planPromises.push(getDocs(query(dietPlansRef, where("createdBy", "==", adminId))));

      // Plans created by staff (if any)
      if (staffIds.length > 0) {
        planPromises.push(getDocs(query(dietPlansRef, where("createdBy", "in", staffIds))));
      }

      const planSnapshots = await Promise.all(planPromises);

      const fetchedPlans: DietPlan[] = [];
      planSnapshots.forEach(snapshot => {
        snapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          fetchedPlans.push({
            ...data,
            id: doc.id,
            createdByName: userMap.get(data.createdBy) || "Admin",
          } as DietPlan);
        });
      });

      // Sort plans by creation date client-side
      fetchedPlans.sort((a, b) => {
        const dateA = a.created ? new Date(a.created) : new Date(0);
        const dateB = b.created ? new Date(b.created) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setDietPlans(fetchedPlans);

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "dietPlans, staff, or admins", operation: 'list' }));
      } else {
        console.error("Error fetching data: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch plans and user data." });
      }
    }
  }

  const fetchCustomers = async () => {
    if (!db) return;
    const customersCollectionRef = collection(db, "customers");
    try {
      const data = await getDocs(customersCollectionRef);
      const fetchedCustomers = data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Customer[];
      setCustomers(fetchedCustomers);
    } catch (error) {
      console.error("Error fetching customers: ", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch customers." });
    }
  };


  useEffect(() => {
    if (auth?.currentUser) {
      fetchPlansAndUsers();
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.currentUser, db]);


  const openAssignDialog = (plan: DietPlan) => {
    setPlanToAssign(plan);
    const currentlyAssigned = customers
      .filter(c => c.dietPlanId === plan.id)
      .map(c => c.id);
    setSelectedCustomers(currentlyAssigned);
    setSearchQuery(""); // Reset search on open
    setIsAssignDialogOpen(true);
  };

  const handleAssignPlan = async () => {
    if (!db || !planToAssign || !auth?.currentUser) {
      toast({ variant: 'destructive', title: "Error", description: "No plan selected or you are not logged in." });
      return;
    }

    const batch = writeBatch(db);
    const notificationsToSend: Array<Promise<any>> = [];

    // Assign to newly selected customers
    selectedCustomers.forEach(customerId => {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      if (customer.dietPlanId !== planToAssign.id) {
        const customerRef = doc(db, "customers", customerId);
        batch.update(customerRef, { dietPlanId: planToAssign.id });

        const historyRef = doc(collection(db, `customers/${customerId}/dietPlanHistory`));
        batch.set(historyRef, {
          planId: planToAssign.id,
          planName: planToAssign.name,
          assignedAt: serverTimestamp(),
          assignedById: auth.currentUser?.uid,
          assignedByName: auth.currentUser?.displayName || "Admin"
        });

        sendTransactionalEmail({
          template: 'adminDietPlanAssigned',
          name: customer.name,
          email: customer.email,
          planName: planToAssign.name,
          assignerName: auth.currentUser?.displayName || "Admin",
        }).catch(console.error);

        if (customer?.mobile) {
          notificationsToSend.push(
            fetch('/api/whatsapp/send-diet-plan-assigned', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: customer.mobile,
                name: customer.name,
                userId: customer.id,
                assignedBy: auth.currentUser?.displayName || "Admin",
                planDetails: planToAssign.name
              })
            }).then(res => res.json())
          );
        }
      }
    });

    // Unassign from customers who were deselected
    const previouslyAssigned = customers.filter(c => c.dietPlanId === planToAssign.id).map(c => c.id);
    const toUnassign = previouslyAssigned.filter(id => !selectedCustomers.includes(id));
    toUnassign.forEach(customerId => {
      const customerRef = doc(db, "customers", customerId);
      batch.update(customerRef, { dietPlanId: null });
    });


    try {
      await batch.commit();
      await Promise.all(notificationsToSend);
      toast({ variant: "success", title: "Success", description: `Plan assignments updated.` });
      setIsAssignDialogOpen(false);
      setPlanToAssign(null);
      setSelectedCustomers([]);
      fetchCustomers(); // Refetch customers to update their plan status
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: 'customers or customers/../dietPlanHistory',
          operation: 'write',
          requestResourceData: { dietPlanId: planToAssign.id } // Example data
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        console.error("Error assigning plan: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not assign diet plan." });
      }
    }
  };

  async function handleDeletePlan() {
    if (!db || !planToDelete) return;
    const planDocRef = doc(db, "dietPlans", planToDelete.id);
    try {
      await deleteDoc(planDocRef);
      toast({ variant: "success", title: "Success", description: "Diet plan deleted." });
      fetchPlansAndUsers();
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: planDocRef.path,
          operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete diet plan." });
      }
    } finally {
      setPlanToDelete(null);
    }
  }

  const handleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Diet Plan Templates</CardTitle>
              <CardDescription>
                Create and manage reusable diet plans to assign to customers.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/admin/diet-plans/builder">
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Add Plan
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
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dietPlans.length > 0 ? dietPlans.map(plan => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.target}</Badge>
                    </TableCell>
                    <TableCell>{plan.createdByName}</TableCell>
                    <TableCell>{plan.created}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center justify-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openAssignDialog(plan)}>
                                <Users className="h-4 w-4" />
                                <span className="sr-only">Assign Plan</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Assign to Customers</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/admin/diet-plans/builder?planId=${plan.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit Plan</span>
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Plan</p>
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setPlanToDelete(plan)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Delete plan</span>
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete Plan</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the {plan.name} diet plan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setPlanToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeletePlan}>Continue</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No diet plans found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card grid */}
          <div className="grid gap-3 md:hidden">
            {dietPlans.length > 0 ? dietPlans.map(plan => (
              <Card key={plan.id} className="border shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{plan.target}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openAssignDialog(plan)}>
                        <Users className="h-4 w-4" />
                        <span className="sr-only">Assign Plan</span>
                      </Button>
                      <Link href={`/admin/diet-plans/builder?planId=${plan.id}`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit Plan</span>
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setPlanToDelete(plan)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete plan</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the {plan.name} diet plan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPlanToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeletePlan}>Continue</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>By: {plan.createdByName}</p>
                    <p>Created: {plan.created}</p>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-center text-muted-foreground py-4">No diet plans found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign: {planToAssign?.name}</DialogTitle>
            <DialogDescription>Select customers to assign this diet plan to.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search customers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="my-2"
          />
          <ScrollArea className="h-72 w-full rounded-md border">
            <div className="p-4">
              {filteredCustomers.length > 0 ? filteredCustomers.map(customer => (
                <div key={customer.id} className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id={`customer-${customer.id}`}
                    checked={selectedCustomers.includes(customer.id)}
                    onCheckedChange={() => handleCustomerSelection(customer.id)}
                  />
                  <Label htmlFor={`customer-${customer.id}`} className="flex flex-col">
                    <span>{customer.name}</span>
                    <span className="text-xs text-muted-foreground">{customer.email}</span>
                  </Label>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center">No customers found.</p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignPlan}>Save Assignments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
