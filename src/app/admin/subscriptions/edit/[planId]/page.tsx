
"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Save, Trash2, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const priceVariantSchema = z.object({
  durationLabel: z.string().min(1, "Label is required"),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  durationMonths: z.coerce.number().min(0).default(0),
  durationDays: z.coerce.number().min(0).default(0),
});

const planSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  features: z.array(z.object({ value: z.string().min(3, "Feature cannot be empty.") })).optional(),
  price: z.coerce.number().optional(),
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

type PlanFormData = z.infer<typeof planSchema>;

export default function EditSubscriptionPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planName, setPlanName] = useState("");
  const { toast } = useToast();
  const { db } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      features: [],
      priceVariants: [],
    }
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

  useEffect(() => {
    if (!db || !planId) return;

    const fetchPlan = async () => {
      setIsLoading(true);
      try {
        const planDocRef = doc(db, "subscriptionPlans", planId);
        const docSnap = await getDoc(planDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const features = data.features ? data.features.map((f: string) => ({ value: f })) : [];
          
          let priceVariants = data.priceVariants;
          // Backwards compatibility for old single-price plans
          if (!priceVariants && (data.planFor === 'vendor' || data.planFor === 'corporate')) {
            priceVariants = [{
              durationLabel: formatDuration(data.durationMonths, data.durationDays) || 'Default',
              price: data.price || 0,
              durationMonths: data.durationMonths || 0,
              durationDays: data.durationDays || 0,
            }];
          }

          form.reset({
            ...data,
            features: features,
            price: data.price,
            durationDays: data.durationDays,
            durationMonths: data.durationMonths,
            priceVariants: priceVariants,
            tag: data.tag || "none",
            displayOrder: data.displayOrder ?? 99,
            vendorShareType: data.vendorShareType || 'percentage',
            vendorShareValue: data.vendorShareValue || 0,
            maxCustomers: data.maxCustomers || 0,
          });
          setPlanName(data.name);
        } else {
          toast({ variant: "destructive", title: "Not Found", description: "Subscription plan not found." });
          router.push("/admin/subscriptions");
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch plan details." });
      } finally {
        setIsLoading(false);
      }
    };
    
    const formatDuration = (months?: number, days?: number) => {
        const parts = [];
        if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
        if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
        return parts.join(', ') || 'Default';
    };

    fetchPlan();
  }, [db, planId, form, toast, router]);

  const onSubmit = async (values: PlanFormData) => {
    if (!db || !planId) return;
    setIsSubmitting(true);

    try {
      const planDocRef = doc(db, "subscriptionPlans", planId);
      const dataToUpdate: any = {
        ...values,
        features: values.features ? values.features.map(f => f.value) : [],
        tag: values.tag === 'none' ? '' : values.tag,
      };
      
      if (values.planFor === 'vendor_customer') {
        dataToUpdate.price = null;
        dataToUpdate.maxCustomers = null;
      } else if (values.planFor === 'vendor') {
        dataToUpdate.price = null;
        dataToUpdate.durationDays = null;
        dataToUpdate.durationMonths = null;
      } else {
        dataToUpdate.priceVariants = null;
      }

      if (values.planFor !== 'vendor' && values.planFor !== 'corporate') {
          dataToUpdate.maxCustomers = null;
      }

      await updateDoc(planDocRef, dataToUpdate);

      toast({ variant: "success", title: "Success", description: "Plan updated successfully." });
      router.push("/admin/subscriptions");
    } catch (error) {
      console.error("Error updating plan: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not update plan." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/subscriptions">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Edit Subscription Plan</CardTitle>
            <CardDescription>
              Update the details for the "{planName}" plan.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
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
                        className="flex items-center space-x-4"
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

            {(planForValue === 'vendor') ? (
                <div>
                  <Label>Price Variants</Label>
                  <div className="space-y-2 mt-2">
                    {priceVariantFields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                        <FormField control={form.control} name={`priceVariants.${index}.durationLabel`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Label</FormLabel><FormControl><Input placeholder="e.g., 1 Month" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`priceVariants.${index}.price`} render={({ field }) => (<FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`priceVariants.${index}.durationMonths`} render={({ field }) => (<FormItem><FormLabel>Months</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`priceVariants.${index}.durationDays`} render={({ field }) => (<FormItem><FormLabel>Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePriceVariant(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendPriceVariant({ durationLabel: "", price: 0, durationMonths: 0, durationDays: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Variant</Button>
                  </div>
                </div>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {planForValue !== 'vendor_customer' && (
                        <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g., 999" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    )}
                    <FormField control={form.control} name="durationMonths" render={({ field }) => (
                        <FormItem><FormLabel>Duration (Months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="durationDays" render={({ field }) => (
                        <FormItem><FormLabel>Duration (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
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
              <Label>Plan Features</Label>
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

            <CardFooter className="px-0 pt-6">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4"/>
                    Save Changes
                </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
