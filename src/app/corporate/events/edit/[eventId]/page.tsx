
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { format } from "date-fns";

const formSchema = z.object({
  title: z.string().min(5, "Event title must be at least 5 characters."),
  description: z.string().optional(),
  venue: z.string().min(3, "Venue is required."),
  eventDate: z.string().min(1, "Event date is required."),
  eventTime: z.string().min(1, "Event time is required."),
  registrationCloseDate: z.string().min(1, "Registration close date is required."),
  participants: z.coerce.number().min(1, "Number of participants is required."),
});

export default function EditEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;
  const { db, auth } = useFirebase();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!auth || !db || !eventId) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            const eventDocRef = doc(db, 'corporateEvents', eventId);
            try {
                const docSnap = await getDoc(eventDocRef);
                if (docSnap.exists() && docSnap.data().corporateId === user.uid) {
                    const data = docSnap.data();
                    const eventDate = data.eventTime.toDate();
                    const registrationClose = data.registrationCloseDate.toDate();
                    
                    form.reset({
                        title: data.title,
                        description: data.description,
                        venue: data.venue,
                        eventDate: format(eventDate, 'yyyy-MM-dd'),
                        eventTime: format(eventDate, 'HH:mm'),
                        registrationCloseDate: format(registrationClose, 'yyyy-MM-dd'),
                        participants: data.participants,
                    });
                } else {
                    toast({ variant: 'destructive', title: 'Not Found', description: "Event not found or you don't have permission to edit it." });
                    router.push('/corporate/events');
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch event data.' });
            } finally {
                setIsLoading(false);
            }
        }
    });
    
    return () => unsubscribe();
  }, [auth, db, eventId, form, router, toast]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      const eventDocRef = doc(db, 'corporateEvents', eventId);
      await updateDoc(eventDocRef, {
        ...data,
        eventTime: Timestamp.fromDate(new Date(`${data.eventDate}T${data.eventTime}`)),
        registrationCloseDate: Timestamp.fromDate(new Date(data.registrationCloseDate)),
      });

      toast({
        variant: "success",
        title: "Event Updated",
        description: `Your event "${data.title}" has been successfully updated.`,
      });
      router.push("/corporate/events");
      
    } catch (error: any) {
      console.error("Error updating event: ", error);
      toast({ variant: "destructive", title: "Error", description: `Could not update event: ${error.message}` });
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
          <Link href="/corporate/events">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Edit Event</CardTitle>
            <CardDescription>Update the details for your event.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-w-2xl mx-auto">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Event Title *</FormLabel><FormControl><Input placeholder="e.g., Annual Health Fair" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="eventDate" render={({ field }) => (
                    <FormItem><FormLabel>Event Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="eventTime" render={({ field }) => (
                    <FormItem><FormLabel>Event Time *</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             <FormField control={form.control} name="venue" render={({ field }) => (
              <FormItem><FormLabel>Venue / Location *</FormLabel><FormControl><Input placeholder="e.g., Company Cafeteria" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="registrationCloseDate" render={({ field }) => (
                    <FormItem><FormLabel>Registration Close Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="participants" render={({ field }) => (
                  <FormItem><FormLabel>No. of Participants *</FormLabel><FormControl><Input type="number" placeholder="e.g., 150" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description / Details (Optional)</FormLabel><FormControl><Textarea placeholder="Provide any additional details about the event..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
