
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { addFITTBOSSGym } from "@/ai/flows/add-FITTBOSS-gym-flow";

const formSchema = z.object({
  name: z.string().min(2, "Gym name is required."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  durationDays: z.coerce.number().min(1, "Duration must be at least 1 day."),
  maxCustomers: z.coerce.number().min(1, "Customer limit must be at least 1."),
});

type GymFormData = z.infer<typeof formSchema>;

export default function AddFitbossGymPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<GymFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
      durationDays: 30,
      maxCustomers: 10,
    },
  });

  const onSubmit = async (data: GymFormData) => {
    setIsSubmitting(true);
    try {
      const result = await addFITTBOSSGym(data);
      if (result.userId) {
        toast({
          variant: "success",
          title: "Gym Added to Challenge",
          description: `${data.name} has been added and a welcome email sent.`,
        });
        router.push("/admin/FITTBOSS-challenge");
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error("Error adding gym: ", error);
      toast({ variant: "destructive", title: "Error", description: `Could not add gym: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/FITTBOSS-challenge">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Gym to FITTBOSS Challenge</CardTitle>
            <CardDescription>Fill in the details to add a new gym as a partner.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Gym Name *</FormLabel><FormControl><Input placeholder="Fitness World" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Owner Email *</FormLabel><FormControl><Input type="email" placeholder="owner@fitnessworld.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address *</FormLabel><FormControl><Input placeholder="123 Fitness Ave, Wellness City" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="durationDays" render={({ field }) => (
                <FormItem><FormLabel>Subscription Validity (Days) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maxCustomers" render={({ field }) => (
                <FormItem><FormLabel>Customer Limit *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Adding Gym..." : "Add Gym"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
