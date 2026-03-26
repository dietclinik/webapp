"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { collection, getDocs, where, query, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// This needs to be created, similar to sendVendorCustomerWelcomeEmail
// import { sendCorporateCustomerWelcomeEmail } from "@/ai/flows/send-corporate-customer-welcome-email-flow";

type Plan = {
  id: string;
  name: string;
};

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  planId: z.string().min(1, "Please select a subscription plan."),
});

type CustomerFormData = z.infer<typeof formSchema>;

export default function CorporateAddCustomerPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [corporate, setCorporate] = useState<FirebaseUser | null>(null);
  const [corporateName, setCorporateName] = useState<string>('');

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      planId: "",
    },
  });

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCorporate(user);
        if(user) {
            const corporateDoc = await getDoc(doc(db, 'corporates', user.uid));
            if(corporateDoc.exists()) {
                setCorporateName(corporateDoc.data().name);
            }
        }
    });
    return () => unsubscribe();
  }, [auth, db]);

  useEffect(() => {
    if (!db) return;
    const fetchPlans = async () => {
      try {
        const plansCollectionRef = collection(db, "subscriptionPlans");
        const q = query(plansCollectionRef, where("status", "==", "Active"));
        const data = await getDocs(q);
        const activePlans = data.docs.map((doc) => ({ ...doc.data(), id: doc.id })) as Plan[];
        setPlans(activePlans);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch subscription plans." });
      }
    };
    fetchPlans();
  }, [db, toast]);

  const onSubmit = async (data: CustomerFormData) => {
    if (!db || !corporate) return;
    setIsSubmitting(true);
    
    try {
        // const result = await sendCorporateCustomerWelcomeEmail({
        //     corporateId: corporate.uid,
        //     corporateName: corporateName,
        //     customerData: {
        //         name: data.name,
        //         email: data.email,
        //         mobile: data.mobile,
        //         planId: data.planId,
        //     },
        // });
        // if (result.userId) {
        //     toast({ variant: "success", title: "Customer Added", description: "A welcome email is being sent." });
        //     router.push("/corporate/customers");
        // } else {
        //     throw new Error(result.message);
        // }
        toast({title: "Coming Soon", description: "This functionality is under construction."});
        router.push("/corporate/customers");
    } catch (error: any) {
        console.error("Error creating customer: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not create customer: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/corporate/customers">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Customer</CardTitle>
            <CardDescription>
              Add a new customer for your corporate event.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 max-w-2xl mx-auto">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile *</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="planId" render={({ field }) => (
                <FormItem><FormLabel>Subscription Plan *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a plan for the customer" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {plans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
            )}/>
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Adding Customer...' : 'Add Customer'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}