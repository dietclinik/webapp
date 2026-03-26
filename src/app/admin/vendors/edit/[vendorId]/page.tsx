
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Save, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { processVendor } from "@/ai/flows/send-vendor-welcome-email-flow";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
});

type VendorFormData = z.infer<typeof formSchema>;

export default function EditVendorPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.vendorId as string;
  const { db } = useFirebase();

  const form = useForm<VendorFormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!db || !vendorId) return;
    
    const fetchVendorData = async () => {
        setIsLoading(true);
        try {
            const vendorDocRef = doc(db, "vendors", vendorId);
            const docSnap = await getDoc(vendorDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setInitialData(data);
                form.reset({
                    name: data.name,
                    mobile: data.mobile,
                    address: data.address,
                });
            } else {
                 toast({ variant: "destructive", title: "Not Found", description: "Vendor not found." });
                 router.push("/admin/vendors");
            }
        } catch (error) {
             toast({ variant: "destructive", title: "Error", description: "Could not fetch vendor data." });
        } finally {
            setIsLoading(false);
        }
    }
    fetchVendorData();
  }, [db, vendorId, form, toast, router]);

  const onSubmit = async (data: VendorFormData) => {
    if (!db || !vendorId) return;
    setIsSubmitting(true);
    
    try {
        const vendorDocRef = doc(db, "vendors", vendorId);
        await updateDoc(vendorDocRef, data);

        toast({ variant: "success", title: "Success", description: "Vendor details updated successfully." });
        router.push("/admin/vendors");

    } catch (error: any) {
        console.error("Error updating vendor: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not update vendor: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleActivateVendor = async () => {
    if(!initialData || !vendorId) return;
    setIsActivating(true);

    try {
       await processVendor({
            paymentSuccess: true, // Manually activating
            vendorId: vendorId, // Pass the current doc ID (which is temporary)
            vendorData: {
                name: initialData.name,
                email: initialData.email,
                mobile: initialData.mobile,
                address: initialData.address,
            }
        });
        
        toast({
          variant: "success",
          title: "Vendor Activated", 
          description: "Welcome email is being sent. Redirecting..." 
        });
        
        setTimeout(() => {
            router.push("/admin/vendors");
        }, 2000);

    } catch (error: any) {
        console.error("Activation Error:", error);
        toast({ variant: "destructive", title: "Error", description: `Could not activate vendor: ${error.message}` });
        setIsActivating(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <Link href="/admin/vendors">
                <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div>
                <CardTitle>Edit Vendor</CardTitle>
                <CardDescription>
                Update the details for {initialData?.name}.
                </CardDescription>
            </div>
            </div>
             {initialData?.paymentStatus === 'Failed' && (
                <Button onClick={handleActivateVendor} disabled={isActivating}>
                     {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UserCheck className="mr-2 h-4 w-4" />
                    Activate and Send Welcome Email
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Fitness World" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Fitness Ave, Wellness City" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <CardFooter className="p-0 pt-6">
                <Button type="submit" disabled={isSubmitting} className="ml-auto">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
