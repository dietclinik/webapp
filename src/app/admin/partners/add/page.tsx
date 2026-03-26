
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { processPartner } from "@/ai/flows/send-partner-welcome-email-flow";

const formSchema = z.object({
  name: z.string().min(2, "Partner name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
});

type PartnerFormData = z.infer<typeof formSchema>;

export default function AddPartnerPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
    },
  });

  const onSubmit = async (data: PartnerFormData) => {
    setIsSubmitting(true);
    try {
      const result = await processPartner({
        paymentSuccess: true, // Admin-added partners are considered successful payments
        vendorData: {
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            address: data.address,
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
            <CardDescription>Fill in the details to add a new partner.</CardDescription>
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
