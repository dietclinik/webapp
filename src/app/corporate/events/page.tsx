
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, CalendarPlus, Pencil, Trash2, Eye, Trophy } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { collection, getDocs, query, where, Timestamp, orderBy, deleteDoc, doc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { deleteCorporateEvent } from "@/ai/flows/delete-corporate-event-flow";


type Event = {
    id: string;
    title: string;
    eventTime: Timestamp;
    status: 'Upcoming' | 'Completed' | 'Cancelled';
    registrationsCount: number;
};

export default function CorporateEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { db, auth } = useFirebase();
  const { toast } = useToast();

  const fetchEvents = async (userId: string) => {
    setLoading(true);
    try {
        const eventsQuery = query(collection(db, "corporateEvents"), where("corporateId", "==", userId));
        const eventsSnapshot = await getDocs(eventsQuery);
        
        const fetchedEvents = await Promise.all(eventsSnapshot.docs.map(async (doc) => {
            const eventData = { id: doc.id, ...doc.data() } as Event;
            const registrationsQuery = query(collection(db, `corporateEvents/${doc.id}/registrations`));
            
            try {
                const registrationsSnapshot = await getDocs(registrationsQuery);
                eventData.registrationsCount = registrationsSnapshot.size;
            } catch (regError: any) {
                if (regError.code === 'permission-denied') {
                     errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: `corporateEvents/${doc.id}/registrations`,
                        operation: 'list'
                    }));
                }
                eventData.registrationsCount = 0;
            }
            
            return eventData;
        }));

        fetchedEvents.sort((a, b) => b.eventTime.toMillis() - a.eventTime.toMillis());
        
        setEvents(fetchedEvents);
    } catch (error: any) {
         if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: "corporateEvents",
                operation: 'list'
            }));
        } else {
            console.error("Error fetching events:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your events.' });
        }
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            fetchEvents(user.uid);
        }
    });

    return () => unsubscribe();
  }, [db, auth, toast]);

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
        await deleteCorporateEvent({ eventId: eventToDelete.id });
        toast({ variant: "success", title: "Event Deleted", description: `"${eventToDelete.title}" has been removed.` });
        if(auth.currentUser) {
            fetchEvents(auth.currentUser.uid);
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: `Could not delete event: ${error.message}` });
    } finally {
        setEventToDelete(null);
    }
  };

  return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2"><CalendarPlus className="h-6 w-6" /> My Events</CardTitle>
                    <CardDescription>Manage events for your employees.</CardDescription>
                </div>
                 <Link href="/corporate/events/add">
                    <Button size="sm" className="h-10 gap-1">
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Create Event</span>
                    </Button>
                </Link>
            </div>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Event Name</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registrations</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                             <TableRow key={i}>
                                <TableCell colSpan={5} className="py-0">
                                    <div className="h-12 animate-pulse bg-muted rounded-md my-2"></div>
                                </TableCell>
                             </TableRow>
                        ))
                    ) : events.length > 0 ? (
                        events.map((event) => (
                            <TableRow key={event.id}>
                                <TableCell className="font-medium">{event.title}</TableCell>
                                <TableCell>{format(event.eventTime.toDate(), 'PPP p')}</TableCell>
                                <TableCell>
                                    <Badge variant={event.status === 'Upcoming' ? 'default' : 'secondary'}>
                                        {event.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{event.registrationsCount}</TableCell>
                                <TableCell className="text-center">
                                    <Link href={`/corporate/events/scoreboard/${event.id}`}>
                                        <Button variant="ghost" size="icon"><Trophy className="h-4 w-4"/></Button>
                                    </Link>
                                    <Link href={`/corporate/events/view/${event.id}`}>
                                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4"/></Button>
                                    </Link>
                                    <Link href={`/corporate/events/edit/${event.id}`}>
                                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4"/></Button>
                                    </Link>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button variant="ghost" size="icon" onClick={() => setEventToDelete(event)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                             </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This action will permanently delete the event "{event.title}". This cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setEventToDelete(null)}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteEvent}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center">
                                No events created yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
