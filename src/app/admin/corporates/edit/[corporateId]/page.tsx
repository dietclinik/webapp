
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
});

type CorporateFormData = z.infer<typeof formSchema>;

export default function EditCorporatePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);

  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const corporateId = params.corporateId as string;
  const { db } = useFirebase();

  const form = useForm<CorporateFormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!db || !corporateId) return;
    
    const fetchCorporateData = async () => {
        setIsLoading(true);
        try {
            const corporateDocRef = doc(db, "corporates", corporateId);
            const docSnap = await getDoc(corporateDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setInitialData(data);
                form.reset({
                    name: data.name,
                    mobile: data.mobile,
                    address: data.address,
                });
            } else {
                 toast({ variant: "destructive", title: "Not Found", description: "Corporate account not found." });
                 router.push("/admin/corporates");
            }
        } catch (error) {
             toast({ variant: "destructive", title: "Error", description: "Could not fetch corporate data." });
        } finally {
            setIsLoading(false);
        }
    }
    fetchCorporateData();
  }, [db, corporateId, form, toast, router]);

  const onSubmit = async (data: CorporateFormData) => {
    if (!db || !corporateId) return;
    setIsSubmitting(true);
    
    try {
        const corporateDocRef = doc(db, "corporates", corporateId);
        await updateDoc(corporateDocRef, data);

        toast({ variant: "success", title: "Success", description: "Corporate details updated successfully." });
        router.push("/admin/corporates");

    } catch (error: any) {
        console.error("Error updating corporate account: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not update corporate account: ${error.message}` });
    } finally {
        setIsSubmitting(false);
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
            <Link href="/admin/corporates">
                <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div>
                <CardTitle>Edit Corporate</CardTitle>
                <CardDescription>
                Update the details for {initialData?.name}.
                </CardDescription>
            </div>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Tech Corp" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Innovation Drive, Silicon Valley" {...field} /></FormControl><FormMessage /></FormItem>
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
