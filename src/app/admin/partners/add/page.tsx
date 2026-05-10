
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle2, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { processPartner } from "@/ai/flows/send-partner-welcome-email-flow";

interface PriceVariant {
  durationLabel: string;
  price: number;
  durationMonths: number;
  durationDays: number;
}

interface Plan {
  id: string;
  name: string;
  tier?: string;
  features?: string[];
  maxCustomers?: number;
  priceVariants?: PriceVariant[];
  tag?: string;
}

const formSchema = z.object({
  name: z.string().min(2, "Partner name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  planId: z.string().min(1, "Please select a plan."),
  variantIndex: z.string().optional(),
});

type PartnerFormData = z.infer<typeof formSchema>;

export default function AddPartnerPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PriceVariant | null>(null);
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
      planId: "",
      variantIndex: "",
    },
  });

  useEffect(() => {
    if (!db) return;
    const fetchPlans = async () => {
      try {
        const plansRef = collection(db, "subscriptionPlans");
        const q = query(plansRef, where("planFor", "==", "vendor"), where("status", "==", "Active"));
        const snapshot = await getDocs(q);
        const fetchedPlans: Plan[] = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          tier: doc.data().tier,
          features: doc.data().features,
          maxCustomers: doc.data().maxCustomers,
          priceVariants: doc.data().priceVariants,
          tag: doc.data().tag,
        }));
        setPlans(fetchedPlans);
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load subscription plans." });
      }
    };
    fetchPlans();
  }, [db, toast]);

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId) || null;
    setSelectedPlan(plan);
    setSelectedVariant(null);
    form.setValue("variantIndex", "");
    if (plan?.priceVariants?.length === 1) {
      setSelectedVariant(plan.priceVariants[0]);
      form.setValue("variantIndex", "0");
    }
  };

  const handleVariantChange = (index: string) => {
    if (selectedPlan?.priceVariants) {
      setSelectedVariant(selectedPlan.priceVariants[parseInt(index)]);
    }
  };

  const onSubmit = async (data: PartnerFormData) => {
    if (selectedPlan?.priceVariants?.length && !selectedVariant) {
      toast({ variant: "destructive", title: "Error", description: "Please select a subscription duration." });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await processPartner({
        paymentSuccess: true,
        vendorData: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          address: data.address,
          planId: data.planId,
          durationMonths: selectedVariant?.durationMonths,
          durationDays: selectedVariant?.durationDays,
          planVariantLabel: selectedVariant?.durationLabel,
          planPrice: selectedVariant?.price,
        }
      });
      if (result.userId) {
        toast({
          variant: "success",
          title: "Partner Created",
          description: `${data.name} has been added and a welcome email has been sent.`,
        });
        router.push("/admin/partners");
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error("Error creating partner: ", error);
      toast({ variant: "destructive", title: "Error", description: `Could not create partner: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/partners">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Partner</CardTitle>
            <CardDescription>Fill in the details to add a new partner. The account will be automatically activated for the selected plan duration.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Partner Name *</FormLabel><FormControl><Input placeholder="Fitness World" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Owner Email *</FormLabel><FormControl><Input type="email" placeholder="owner@fitnessworld.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="planId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Plan *</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); handlePlanChange(v); }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}{plan.tier ? ` (${plan.tier})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedPlan?.priceVariants && selectedPlan.priceVariants.length > 1 && (
                <FormField control={form.control} name="variantIndex" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration *</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); handleVariantChange(v); }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedPlan.priceVariants!.map((variant, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {variant.durationLabel} — ₹{variant.price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {selectedPlan && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-sm">Plan Details: {selectedPlan.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedPlan.tier && <Badge variant="outline">{selectedPlan.tier}</Badge>}
                    {selectedPlan.tag && <Badge>{selectedPlan.tag}</Badge>}
                  </div>
                </div>

                {selectedPlan.maxCustomers !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>Up to {selectedPlan.maxCustomers} customers</span>
                  </div>
                )}

                {selectedVariant && (
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      Partner will be active for <strong>{selectedVariant.durationLabel}</strong> — ₹{selectedVariant.price.toLocaleString()}
                    </span>
                  </div>
                )}

                {selectedPlan.features && selectedPlan.features.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {selectedPlan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Fitness Ave, Wellness City" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Add Partner"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
