
"use client";

import { PlusCircle, CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
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
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type Event = {
    id: string;
    title: string;
    corporateName: string;
    eventTime: Timestamp;
    status: 'Upcoming' | 'Completed' | 'Cancelled';
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { db } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const eventsQuery = query(collection(db, "events"), orderBy("eventTime", "desc"));
            const eventsSnapshot = await getDocs(eventsQuery);
            const fetchedEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
            setEvents(fetchedEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch events.' });
        } finally {
            setLoading(false);
        }
    }
    fetchEvents();
  }, [db, toast]);

  return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2"><CalendarPlus className="h-6 w-6" /> Events</CardTitle>
                    <CardDescription>Manage all your corporate events.</CardDescription>
                </div>
                 <Link href="/admin/events/add">
                    <Button size="sm" className="h-10 gap-1">
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Event</span>
                    </Button>
                </Link>
            </div>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Event Name</TableHead>
                        <TableHead>Corporate</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Status</TableHead>
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
                                <TableCell>{event.corporateName}</TableCell>
                                <TableCell>{format(event.eventTime.toDate(), 'PPP p')}</TableCell>
                                <TableCell>
                                    <Badge variant={event.status === 'Upcoming' ? 'default' : 'secondary'}>
                                        {event.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon"><Pencil className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
