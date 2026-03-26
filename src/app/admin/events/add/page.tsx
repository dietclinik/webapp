
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { collection, getDocs } from "firebase/firestore";
import { createCorporateEvent } from "@/ai/flows/create-event-flow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Corporate = {
  id: string;
  name: string;
  email: string;
};

const formSchema = z.object({
  title: z.string().min(5, "Event title must be at least 5 characters."),
  description: z.string().optional(),
  corporateId: z.string().min(1, "You must select a corporate partner."),
  venue: z.string().min(3, "Venue is required."),
  eventDate: z.string().min(1, "Event date is required."),
  eventTime: z.string().min(1, "Event time is required."),
  registrationCloseDate: z.string().min(1, "Registration close date is required."),
  participants: z.coerce.number().min(1, "Number of participants is required."),
});

export default function AddEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [corporates, setCorporates] = useState<Corporate[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { db } = useFirebase();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      corporateId: "",
      venue: "",
      eventDate: "",
      eventTime: "",
      registrationCloseDate: "",
      participants: 0,
    },
  });

  useEffect(() => {
    if (!db) return;
    const fetchCorporates = async () => {
        try {
            const corporatesSnapshot = await getDocs(collection(db, "corporates"));
            const fetchedCorporates = corporatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Corporate));
            setCorporates(fetchedCorporates);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch corporate partners.' });
        }
    }
    fetchCorporates();
  }, [db, toast]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const selectedCorporate = corporates.find(c => c.id === data.corporateId);
    if (!selectedCorporate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid corporate selected.' });
        setIsSubmitting(false);
        return;
    }
    
    try {
      const result = await createCorporateEvent({
        ...data,
        corporateName: selectedCorporate.name,
        corporateEmail: selectedCorporate.email,
        eventTime: `${data.eventDate}T${data.eventTime}`,
      });

      if (result.success && result.eventId) {
        toast({
          variant: "success",
          title: "Event Created",
          description: `An email notification has been sent to ${selectedCorporate.name}.`,
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
          <Link href="/admin/events">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>Schedule New Event</CardTitle>
            <CardDescription>Fill in the details to create a new corporate event.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-w-2xl mx-auto">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Event Title *</FormLabel><FormControl><Input placeholder="e.g., Annual Health Fair" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField
              control={form.control}
              name="corporateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corporate Partner *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a corporate partner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {corporates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormItem><FormLabel>Expected No. of Participants *</FormLabel><FormControl><Input type="number" placeholder="e.g., 150" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description / Details (Optional)</FormLabel><FormControl><Textarea placeholder="Provide any additional details about the event..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter className="max-w-2xl mx-auto">
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Create Event"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <Dialog open={showLinkDialog} onOpenChange={(open) => { if (!open) router.push('/admin/events'); }}>
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
                    <Button type="button" onClick={() => router.push('/admin/events')}>Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
