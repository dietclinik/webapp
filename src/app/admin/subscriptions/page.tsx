
"use client";

import {
  PlusCircle,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react"
import { useState, useEffect } from "react";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { useRouter } from "next/navigation";

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
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

const priceVariantSchema = z.object({
  durationLabel: z.string().min(1, "Label is required"),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  durationMonths: z.coerce.number().min(0).default(0),
  durationDays: z.coerce.number().min(0).default(0),
});

const basePlanSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  price: z.coerce.number().optional(),
  features: z.array(z.object({ value: z.string().min(3, "Feature cannot be empty.") })).optional(),
  durationMonths: z.coerce.number().optional(),
  durationDays: z.coerce.number().optional(),
  priceVariants: z.array(priceVariantSchema).optional(),
  showOnFrontend: z.boolean().default(true),
  tier: z.string().min(1, "Plan tier is required.").default("Basic"),
  planType: z.enum(["self", "dietician"]).default("dietician"),
  planFor: z.enum(["customer", "vendor", "corporate", "vendor_customer"]).default("customer"),
  tag: z.string().optional(),
  displayOrder: z.coerce.number().optional(),
  vendorShareType: z.enum(['percentage', 'fixed']).optional(),
  vendorShareValue: z.coerce.number().optional(),
  maxCustomers: z.coerce.number().optional(),
});

type Plan = z.infer<typeof basePlanSchema> & {
    id: string;
    status: 'Active' | 'Archived';
    vendorVisible?: boolean;
    customFields?: { [key: string]: any };
}

type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'switch';
  required: boolean;
  placeholder?: string;
};


export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formSchema, setFormSchema] = useState(basePlanSchema);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  
  const baseDefaultValues = {
    name: "",
    price: 0,
    features: [],
    durationMonths: 1,
    durationDays: 0,
    priceVariants: [{ durationLabel: "1 Month", price: 0, durationMonths: 1, durationDays: 0 }],
    showOnFrontend: true,
    tier: "Basic",
    planType: "dietician" as "self" | "dietician",
    planFor: "customer" as "customer" | "vendor" | "corporate" | "vendor_customer",
    tag: "none",
    displayOrder: 99,
    vendorShareType: "percentage" as "percentage" | "fixed",
    vendorShareValue: 0,
    maxCustomers: 0,
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: baseDefaultValues,
  });
  
  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control: form.control,
    name: "features"
  });

  const { fields: priceVariantFields, append: appendPriceVariant, remove: removePriceVariant } = useFieldArray({
      control: form.control,
      name: "priceVariants"
  });
  
  const planForValue = useWatch({
    control: form.control,
    name: 'planFor',
  });

  const fetchPlans = async () => {
    if (!db) return;
    const plansCollectionRef = collection(db, "subscriptionPlans");
    try {
        const data = await getDocs(plansCollectionRef);
        const fetchedPlans = data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Plan[];
        setPlans(fetchedPlans);
    } catch (error) {
        console.error("Error fetching plans: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not fetch subscription plans." });
    }
  }

  useEffect(() => {
    if(db) {
        fetchPlans();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!db) return;

    const newPlanData: any = {
        ...values,
        features: values.features ? values.features.map(f => f.value) : [],
        tag: values.tag === 'none' ? '' : values.tag,
        status: 'Active',
    };

    if (values.planFor === 'vendor_customer') {
        delete newPlanData.price;
        delete newPlanData.maxCustomers;
    } else if (values.planFor === 'vendor') {
        delete newPlanData.price;
        delete newPlanData.durationMonths;
        delete newPlanData.durationDays;
    } else {
        delete newPlanData.priceVariants;
    }
    
    if (values.planFor !== 'vendor' && values.planFor !== 'corporate') {
        delete newPlanData.maxCustomers;
    }


    try {
        await addDoc(collection(db, "subscriptionPlans"), newPlanData);
        toast({ variant: "success", title: "Success", description: "Plan added successfully." });
        fetchPlans();
        form.reset();
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error adding plan: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not add plan." });
    }
  }

  async function handleDeletePlan() {
    if (!db || !planToDelete) return;
    const planDoc = doc(db, "subscriptionPlans", planToDelete.id);
    try {
        await deleteDoc(planDoc);
        toast({ variant: "success", title: "Success", description: "Plan deleted." });
        fetchPlans();
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete plan." });
    } finally {
        setPlanToDelete(null);
    }
  }

  async function toggleShowOnFrontend(id: string, currentValue: boolean) {
    if (!db) return;
    const planDocRef = doc(db, "subscriptionPlans", id);
    try {
      await updateDoc(planDocRef, { showOnFrontend: !currentValue });
      toast({ variant: "success", title: "Success", description: "Plan visibility updated." });
      fetchPlans();
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Could not update plan visibility." });
    }
  }

  async function togglePartnerVisible(id: string, currentValue: boolean) {
    if (!db) return;
    const planDocRef = doc(db, "subscriptionPlans", id);
    try {
      await updateDoc(planDocRef, { vendorVisible: !currentValue });
      toast({ variant: "success", title: "Success", description: "Partner visibility updated." });
      fetchPlans();
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Could not update partner visibility." });
    }
  }
  
  const formatDuration = (months?: number, days?: number) => {
    const parts = [];
    if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  const renderPlanTable = (planFor: ("customer" | "vendor" | "corporate" | "vendor_customer")[]) => {
    const filteredPlans = plans.filter(p => planFor.includes(p.planFor || 'customer'));
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Show on Homepage</TableHead>
                    <TableHead>Partner Visible</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredPlans.length > 0 ? filteredPlans.map(plan => (
                    <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{plan.planType}</Badge></TableCell>
                    <TableCell>
                    <Switch
                        checked={plan.showOnFrontend}
                        onCheckedChange={() => toggleShowOnFrontend(plan.id, plan.showOnFrontend ?? true)}
                    />
                    </TableCell>
                    <TableCell>
                    <Switch
                        checked={plan.vendorVisible}
                        onCheckedChange={() => togglePartnerVisible(plan.id, plan.vendorVisible ?? false)}
                    />
                    </TableCell>
                    <TableCell>
                    <TooltipProvider>
                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Link href={`/admin/subscriptions/edit/${plan.id}`}>
                                        <Button variant="ghost" size="icon">
                                            <Pencil className="h-4 w-4" />
                                            <span className="sr-only">Edit plan</span>
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
                                            This action cannot be undone. This will permanently delete the {plan.name} plan.
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
                    <TableCell colSpan={7} className="text-center">No plans found for this category.</TableCell>
                </TableRow>
                )}
            </TableBody>
        </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                Add, edit, and manage subscription plans for customers and partners.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                         <Button size="sm" className="h-8 gap-1">
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Plan
                            </span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                        <DialogTitle>Add New Plan</DialogTitle>
                        <DialogDescription>
                            Fill in the details below to add a new subscription plan.
                        </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <ScrollArea className="h-96 w-full pr-4">
                                <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="planFor"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                        <FormLabel>Plan For *</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-2"
                                            >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="customer" /></FormControl>
                                                <FormLabel className="font-normal">General Customer</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="vendor_customer" /></FormControl>
                                                <FormLabel className="font-normal">Partner's Customer</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="vendor" /></FormControl>
                                                <FormLabel className="font-normal">Partner</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="corporate" /></FormControl>
                                                <FormLabel className="font-normal">Corporate</FormLabel>
                                            </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Plan Name</FormLabel><FormControl><Input placeholder="e.g., Premium" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                
                                {planForValue === 'vendor' ? (
                                    <div>
                                        <Label>Price Variants</Label>
                                        <div className="space-y-2 mt-2">
                                            {priceVariantFields.map((field, index) => (
                                            <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                                                <FormField control={form.control} name={`priceVariants.${index}.durationLabel`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Label</FormLabel><FormControl><Input placeholder="e.g., 1 Month" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`priceVariants.${index}.price`} render={({ field }) => (<FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removePriceVariant(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => appendPriceVariant({ durationLabel: "", price: 0, durationMonths: 0, durationDays: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Variant</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                     {(planForValue === 'customer' || planForValue === 'corporate') && (
                                        <FormField control={form.control} name="price" render={({ field }) => (
                                            <FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g., 999" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                     )}
                                     <div className="flex gap-4">
                                        <FormField control={form.control} name="durationMonths" render={({ field }) => (
                                            <FormItem className="flex-1"><FormLabel>Duration (Months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="durationDays" render={({ field }) => (
                                            <FormItem className="flex-1"><FormLabel>Duration (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                    </>
                                )}

                                {(planForValue === 'vendor' || planForValue === 'corporate') && (
                                    <FormField control={form.control} name="maxCustomers" render={({ field }) => (
                                        <FormItem><FormLabel>Max Customers</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                )}
                                
                                <FormField
                                    control={form.control}
                                    name="planType"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                        <FormLabel>Plan Type *</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex space-x-4"
                                            >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="dietician" /></FormControl>
                                                <FormLabel className="font-normal">Dietician Plan</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="self" /></FormControl>
                                                <FormLabel className="font-normal">Self-Diet Plan</FormLabel>
                                            </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div>
                                <FormLabel>Plan Features</FormLabel>
                                <div className="space-y-2 mt-2">
                                    {featureFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <FormField
                                            control={form.control}
                                            name={`features.${index}.value`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder={`Feature ${index + 1}`} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                            />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFeature(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendFeature({ value: "" })}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Feature
                                    </Button>
                                </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="tier" render={({ field }) => (
                                        <FormItem><FormLabel>Plan Tier</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a tier" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Basic">Basic</SelectItem>
                                                <SelectItem value="Premium">Premium</SelectItem>
                                                <SelectItem value="Pro">Pro</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="tag" render={({ field }) => (
                                        <FormItem><FormLabel>Tag</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a tag" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="Most Popular">Most Popular</SelectItem>
                                                <SelectItem value="Hot">Hot</SelectItem>
                                                <SelectItem value="Trending">Trending</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <FormField control={form.control} name="displayOrder" render={({ field }) => (
                                    <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>

                                <FormField control={form.control} name="showOnFrontend" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                      <div className="space-y-0.5"><FormLabel>Show on Homepage</FormLabel></div>
                                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl>
                                    </FormItem>
                                )}/>
                                </div>
                                </ScrollArea>
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                    <Button type="submit">Add Plan</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="customer">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="customer">Customer Plans</TabsTrigger>
                <TabsTrigger value="vendor_customer">Partner's Customer Plans</TabsTrigger>
                <TabsTrigger value="vendor">Partner Plans</TabsTrigger>
                <TabsTrigger value="corporate">Corporate Plans</TabsTrigger>
            </TabsList>
            <TabsContent value="customer" className="mt-4">
                {renderPlanTable(["customer"])}
            </TabsContent>
            <TabsContent value="vendor_customer" className="mt-4">
                {renderPlanTable(["vendor_customer"])}
            </TabsContent>
            <TabsContent value="vendor" className="mt-4">
                {renderPlanTable(["vendor"])}
            </TabsContent>
            <TabsContent value="corporate" className="mt-4">
                {renderPlanTable(["corporate"])}
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
