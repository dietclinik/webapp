

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  User,
  HeartPulse,
  FileCheck2,
  Loader2
} from "lucide-react";
import { format, addMonths, addDays } from "date-fns";
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { processVendor } from "@/ai/flows/send-vendor-welcome-email-flow";
import RazorpayButton from "@/components/razorpay-button";
import { Header } from "@/components/header";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { onAuthStateChanged } from "firebase/auth";


type Plan = {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  durationDays: number;
};

const formSchema = z.object({
  name: z.string().min(2, "Your name or business name is required."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  email: z.string().email("Invalid email address."),
  address: z.string().min(5, "Address is required."),
  consent: z.boolean().refine(val => val === true, "You must accept the terms and conditions."),
});

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
]

export default function VendorRegisterPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mobile: "",
      email: "",
      address: "",
      consent: false
    },
  });

  useEffect(() => {
    if (!db || !planId) return;

    const fetchPlanDetails = async () => {
        const planDocRef = doc(db, "subscriptionPlans", planId);
        try {
            const docSnap = await getDoc(planDocRef);
            if(docSnap.exists()){
                setPlan({ ...docSnap.data(), id: docSnap.id } as Plan);
            } else {
                 toast({ variant: "destructive", title: "Error", description: "Subscription plan not found." });
                 router.push('/vendor-register');
            }
        } catch(e) {
             toast({ variant: "destructive", title: "Error", description: "Could not fetch plan details." });
        }
    };
    
    fetchPlanDetails();
  }, [db, planId, toast, router]);

  const handlePaymentResult = async (success: boolean) => {
    if (!plan) return;
    
    setIsSubmitting(true);
    const formData = form.getValues();
    
    try {
        const result = await processVendor({
          paymentSuccess: success,
          vendorData: {
              name: formData.name,
              email: formData.email,
              mobile: formData.mobile,
              address: formData.address,
          }
        });

        if (success) {
            toast({ 
              title: "Registration Successful!", 
              description: "Your account is set. Check your email for login details." 
            });
            router.push("/vendor/login");
        } else {
            toast({
              variant: "destructive",
              title: "Payment Failed",
              description: "Your details have been saved. The admin will review your application."
            });
            router.push("/");
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "Registration Error", description: `An error occurred: ${error.message}` });
      } finally {
        setIsSubmitting(false);
      }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" showNavLinks={false} loginUrl="/vendor/login" />
      <main className="flex-1 flex items-center justify-center">
        <div className="container py-12">
            <Card className="max-w-xl mx-auto">
            <CardHeader>
                <div className="flex items-center gap-4">
                <Link href="/vendor-register">
                    <Button variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <CardTitle>Register as a Vendor: {plan?.name || "..."}</CardTitle>
                    <CardDescription>
                    Complete your registration to get listed on our platform.
                    </CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent>
                <FormProvider {...form}>
                <form>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Your Name or Business Name" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="mobile" render={({ field }) => (
                                <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="john@example.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Main St, City" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />

                        <FormField control={form.control} name="consent" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Acknowledge & Consent</FormLabel>
                                    <FormDescription>I acknowledge that I have read and agree to the terms of service and privacy policy.</FormDescription>
                                    <FormMessage />
                                </div>
                            </FormItem>
                        )} />
                    </div>
                </form>
                </FormProvider>
            </CardContent>
            <CardFooter>
                <div className="w-full flex justify-end">
                {plan && plan.price > 0 ? (
                    <RazorpayButton 
                        planName={plan.name}
                        amount={plan.price}
                        customerName={form.getValues().name!}
                        customerEmail={form.getValues().email!}
                        customerPhone={form.getValues().mobile!}
                        onPaymentSuccess={() => handlePaymentResult(true)}
                        onPaymentError={() => handlePaymentResult(false)}
                        disabled={isSubmitting || !form.formState.isValid}
                        buttonText="Submit & Pay"
                        closeDialog={() => {}}
                    />
                ) : (
                      <Button 
                        onClick={form.handleSubmit(() => handlePaymentResult(true))} 
                        disabled={isSubmitting || !form.formState.isValid}
                      >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Complete Registration
                      </Button>
                )}
                </div>
            </CardFooter>
            </Card>
        </div>
      </main>
      <div className="border-t">
          <div className="container mx-auto py-4 px-4 md:px-6">
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {policyLinks.map(link => (
                    <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {link.label}
                    </Link>
                  ))}
              </nav>
          </div>
      </div>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <p className="text-sm text-muted-foreground">App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Vorynto Pvt. Ltd.</a></p>
        </nav>
      </footer>
    </div>
  );
}

    
