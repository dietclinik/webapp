
"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { uploadStaffFilesAndCreateStaff } from "@/ai/flows/upload-staff-files-flow";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  address: z.string().min(5, "Address is required."),
  experience: z.coerce.number().min(0, "Experience cannot be negative."),
  photo: z.instanceof(File).optional(),
  resume: z.instanceof(File).optional(),
});

type StaffFormData = z.infer<typeof formSchema>;

// Helper to convert file to Base64 Data URI
const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


export default function AddStaffPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  
  const form = useForm<StaffFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
      experience: 0,
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        form.setValue("photo", file);
        setImagePreview(URL.createObjectURL(file));
    }
  }

  const onSubmit = async (data: StaffFormData) => {
    setIsSubmitting(true);
    
    try {
        let photoDataUri: string | undefined = undefined;
        if(data.photo) {
            photoDataUri = await fileToDataURI(data.photo);
        }

        let resumeDataUri: string | undefined = undefined;
        if(data.resume) {
            resumeDataUri = await fileToDataURI(data.resume);
        }

        const result = await uploadStaffFilesAndCreateStaff({
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            address: data.address,
            experience: data.experience,
            photoDataUri,
            resumeDataUri,
        });

        if (result.userId) {
             toast({
                variant: "success",
                title: "Staff Member Created", 
                description: `${data.name} has been added and a welcome email has been sent.`
            });
            router.push("/admin/staff");
        } else {
            throw new Error(result.message);
        }

    } catch (error: any) {
        console.error("Error creating staff member: ", error);
        toast({ variant: "destructive", title: "Error", description: `Could not create staff: ${error.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

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
            <CardTitle>Add New Staff Member</CardTitle>
            <CardDescription>
              Fill in the details to add a new staff member to the system.
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
                 <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl><FormMessage /></FormItem>
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

             <FormField
                control={form.control}
                name="resume"
                render={({ field: { onChange, value, ...rest }}) => (
                    <FormItem>
                        <FormLabel>Resume (PDF)</FormLabel>
                        <FormControl>
                            <Input type="file" accept=".pdf" onChange={(e) => onChange(e.target.files?.[0])} {...rest} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <CardFooter className="p-0 pt-6">
                <Button type="submit" disabled={isSubmitting} className="ml-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Create Staff Member'}
                </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
