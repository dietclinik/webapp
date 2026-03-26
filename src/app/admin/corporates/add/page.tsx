
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
import { sendCorporateWelcomeEmail } from "@/ai/flows/send-corporate-welcome-email-flow";

const formSchema = z.object({
  name: z.string().min(2, "Corporate name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
});

type CorporateFormData = z.infer<typeof formSchema>;

export default function AddCorporatePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<CorporateFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
    },
  });

  const onSubmit = async (data: CorporateFormData) => {
    setIsSubmitting(true);
    try {
      const result = await sendCorporateWelcomeEmail({
        paymentSuccess: true, // Manually added corporates are considered paid
        corporateData: {
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            address: data.address,
            planId: 'manual_admin_created' // Placeholder plan for manually added
        }
      });
      if (result.userId) {
        toast({
          variant: "success",
          title: "Corporate Account Created",
          description: `${data.name} has been added and a welcome email has been sent.`,
        });
        router.push("/admin/corporates");
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error("Error creating corporate: ", error);
      toast({ variant: "destructive", title: "Error", description: `Could not create corporate: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/admin/corporates">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Add New Corporate</CardTitle>
            <CardDescription>Fill in the details to add a new corporate partner.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input placeholder="Tech Corp" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Contact Email *</FormLabel><FormControl><Input type="email" placeholder="contact@techcorp.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Innovation Drive, Silicon Valley" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Add Corporate"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

