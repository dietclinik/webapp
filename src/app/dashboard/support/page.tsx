
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, Timestamp, getDoc, doc } from "firebase/firestore";
import { format } from "date-fns";
import { createTicket } from "@/ai/flows/create-ticket-flow";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, MessageSquare, Ticket, Eye } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
});

type Ticket = {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Closed';
  createdAt: Timestamp;
};

export default function SupportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const { toast } = useToast();
  const { auth, db } = useFirebase();

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setLoadingTickets(true);
        
        try {
            const customerDocRef = doc(db, 'customers', user.uid);
            const customerDoc = await getDoc(customerDocRef);
            if (customerDoc.exists()) {
                setCustomerName(customerDoc.data().name);
            }

            const q = query(
              collection(db, "supportTickets"),
              where("userId", "==", user.uid)
            );

            const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
              const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
              fetchedTickets.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
              setTickets(fetchedTickets);
              setLoadingTickets(false);
            }, (error) => {
                const permissionError = new FirestorePermissionError({
                  path: `supportTickets where userId == ${user.uid}`,
                  operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                // We are not showing a toast here because the FirebaseErrorListener will handle it.
                setLoadingTickets(false);
            });
            
            return () => unsubscribeSnapshot();
        } catch (error) {
             console.error("Error setting up ticket listener:", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not initialize support tickets.' });
             setLoadingTickets(false);
        }

      } else {
        setLoadingTickets(false);
      }
    });
    return () => unsubscribeAuth();
  }, [auth, db, toast]);

  const onSubmit = async (data: z.infer<typeof ticketSchema>) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to create a ticket.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createTicket({
        userId: currentUser.uid,
        customerName: customerName || currentUser.displayName || 'Customer',
        subject: data.subject,
        description: data.description,
      });

      if (result.success) {
        toast({ title: 'Ticket Submitted', description: 'Our team will get back to you shortly.', variant: 'success' });
        form.reset();
      } else {
        throw new Error('Failed to create ticket on the server.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Create a Support Ticket</CardTitle>
          <CardDescription>Have an issue or a question? Let us know.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Issue with my diet plan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Please describe your issue in detail..." {...field} rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="ml-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Ticket
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
          <CardDescription>A history of your support requests.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Table — md and above */}
          <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Raised</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTickets ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">...{ticket.id.slice(-6)}</TableCell>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>
                      <Badge variant={ticket.status === 'Closed' ? 'secondary' : 'default'}>{ticket.status}</Badge>
                    </TableCell>
                    <TableCell>{format(ticket.createdAt.toDate(), 'PPP')}</TableCell>
                    <TableCell className="text-right">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href={`/dashboard/support/${ticket.id}`}>
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>View Ticket</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">You haven't raised any tickets yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Cards — below md */}
          <div className="grid gap-3 md:hidden">
            {loadingTickets ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            ) : tickets.length > 0 ? (
              tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="font-mono text-xs text-muted-foreground">#{ticket.id.slice(-6)}</p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/dashboard/support/${ticket.id}`} className="shrink-0">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View Ticket</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={ticket.status === 'Closed' ? 'secondary' : 'default'}>{ticket.status}</Badge>
                    <span className="text-xs text-muted-foreground">{format(ticket.createdAt.toDate(), 'PP')}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-6">You haven't raised any tickets yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
