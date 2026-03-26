
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createCorporateEventByPartner, type CreateEventByPartnerInput } from "@/ai/flows/create-corporate-event-by-partner-flow";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

const formSchema = z.object({
  title: z.string().min(5, "Event title must be at least 5 characters."),
  description: z.string().optional(),
  venue: z.string().min(3, "Venue is required."),
  eventDate: z.string().min(1, "Event date is required."),
  eventTime: z.string().min(1, "Event time is required."),
  registrationCloseDate: z.string().min(1, "Registration close date is required."),
  participants: z.coerce.number().min(1, "Number of participants is required."),
});

export default function AddEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerLimit, setCustomerLimit] = useState<number | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { db, auth } = useFirebase();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      venue: "",
      eventDate: "",
      eventTime: "",
      registrationCloseDate: "",
      participants: 0,
    },
  });

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if(currentUser) {
            const vendorDoc = await getDoc(doc(db, 'corporates', currentUser.uid));
            if(vendorDoc.exists()) {
                const vendorData = vendorDoc.data();
                if (vendorData.planId) {
                    const planDoc = await getDoc(doc(db, 'subscriptionPlans', vendorData.planId));
                    if(planDoc.exists()){ 
                      const planData = planDoc.data();
                      setCustomerLimit(planData.maxCustomers || null); 
                      form.setValue('participants', planData.maxCustomers || 0);
                    }
                } else { setCustomerLimit(0); }
            }
        }
    });
    return () => unsubscribe();
  }, [auth, db, form]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create an event." });
        return;
    }
    if (customerLimit !== null && data.participants > customerLimit) {
        toast({
            variant: "destructive",
            title: "Participant Limit Exceeded",
            description: `Your plan allows for a maximum of ${customerLimit} participants.`
        });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await createCorporateEventByPartner({
        ...data,
        corporateId: user.uid,
        eventTime: `${data.eventDate}T${data.eventTime}`,
      });

      if (result.success && result.eventId) {
        toast({
          variant: "success",
          title: "Event Created",
          description: `Your event "${data.title}" has been scheduled.`,
        });
        setGeneratedLink(`https://app.dietclinik.com/events/register/${result.eventId}`);
        setShowLinkDialog(true);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error("Error creating event: ", error);
      toast({ variant: "destructive", title: "Error", description: `Could not create event: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/corporate/events">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Create New Event</CardTitle>
            <CardDescription>Fill in the details for your new event.</CardDescription>
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
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <Dialog open={showLinkDialog} onOpenChange={(open) => { if (!open) router.push('/corporate/events'); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Event Created Successfully!</DialogTitle>
                <DialogDescription>Share this link with attendees for registration.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
                <Input value={generatedLink} readOnly />
                <Button type="button" size="sm" className="px-3" onClick={copyToClipboard}>
                    {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                </Button>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" onClick={() => router.push('/corporate/events')}>Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
