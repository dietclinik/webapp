
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  experience: z.coerce.number().min(0, "Experience cannot be negative."),
  photo: z.instanceof(File).optional(),
});

type StaffFormData = z.infer<typeof formSchema>;

const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export default function EditStaffPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>(null);

  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const staffId = params.staffId as string;
  const { db, storage } = useFirebase();

  const form = useForm<StaffFormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!db || !staffId) return;
    
    const fetchStaffData = async () => {
        setIsLoading(true);
        try {
            const staffDocRef = doc(db, "staff", staffId);
            const docSnap = await getDoc(staffDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setInitialData(data);
                form.reset({
                    name: data.name,
                    mobile: data.mobile,
                    address: data.address,
                    experience: data.experience,
                });
                if(data.photoURL) {
                    setImagePreview(data.photoURL);
                }
            } else {
                 toast({ variant: "destructive", title: "Not Found", description: "Staff member not found." });
                 router.push("/admin/staff");
            }
        } catch (error) {
             toast({ variant: "destructive", title: "Error", description: "Could not fetch staff data." });
        } finally {
            setIsLoading(false);
        }
    }
    fetchStaffData();
  }, [db, staffId, form, toast, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        form.setValue("photo", file);
        setImagePreview(URL.createObjectURL(file));
    }
  }

  const onSubmit = async (data: StaffFormData) => {
    if (!db || !storage || !staffId) return;
    setIsSubmitting(true);
    
    try {
        let photoURL = initialData.photoURL;
        if(data.photo) {
            const storageRef = ref(storage, `staff_photos/${staffId}_${data.photo.name}`);
            const uploadResult = await uploadBytes(storageRef, data.photo);
            photoURL = await getDownloadURL(uploadResult.ref);
        }
        
        const dataToUpdate = {
            name: data.name,
            mobile: data.mobile,
            address: data.address,
            experience: data.experience,
            photoURL: photoURL,
        };

        const staffDocRef = doc(db, "staff", staffId);
        await updateDoc(staffDocRef, dataToUpdate);

        toast({ variant: "success", title: "Success", description: "Staff member updated successfully." });
        router.push("/admin/staff");

    } catch (error: any) {
        console.error("Error updating staff member: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not update staff: ${error.message}` });
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
        <div className="flex items-center gap-4">
          <Link href="/admin/staff">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Edit Staff Member</CardTitle>
            <CardDescription>
              Update the details for {initialData?.name}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={imagePreview || undefined} alt="Profile Preview" />
                    <AvatarFallback>{form.watch("name")?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <div className="space-y-2 text-center">
                    <FormField
                        control={form.control}
                        name="photo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel htmlFor="photo" className="cursor-pointer text-primary hover:underline">
                                    Upload Photo
                                </FormLabel>
                                <FormControl>
                                    <Input id="photo" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                </FormControl>
                                <FormMessage />
                             </FormItem>
                        )}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="experience" render={({ field }) => (
                    <FormItem><FormLabel>Years of Experience *</FormLabel><FormControl><Input type="number" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea placeholder="123 Main St, City, Country" {...field} /></FormControl><FormMessage /></FormItem>
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
