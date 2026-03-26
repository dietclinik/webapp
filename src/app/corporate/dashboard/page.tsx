
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Video } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, Timestamp, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type Event = {
    id: string;
    title: string;
    eventTime: Timestamp;
    venue: string;
};

export default function CorporateDashboardPage() {
    const [customerCount, setCustomerCount] = useState(0);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [corporateName, setCorporateName] = useState("");
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) {
            setLoading(false);
            return;
        }

        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoading(true);
                try {
                    const corporateDocRef = doc(db, 'corporates', user.uid);
                    const corporateDocSnap = await getDoc(corporateDocRef);
                    if (corporateDocSnap.exists()) {
                        setCorporateName(corporateDocSnap.data().name);
                    }

                    // Fetch customer count
                    const customerQuery = query(collection(db, "customers"), where("corporateId", "==", user.uid));
                    const customerSnapshot = await getDocs(customerQuery);
                    setCustomerCount(customerSnapshot.size);

                    // Fetch events
                    const eventsQuery = query(collection(db, "events"), where("corporateId", "==", user.uid), orderBy("eventTime", "desc"));
                    const eventsSnapshot = await getDocs(eventsQuery);
                    const fetchedEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
                    setEvents(fetchedEvents);

                } catch (error) {
                    console.error("Error fetching dashboard data:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => authUnsubscribe();
    }, [auth, db]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, {corporateName || 'Partner'}!</CardTitle>
                    <CardDescription>Here's a quick overview of your event customers and upcoming events.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                Total Customers Added
                                </CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{customerCount}</div>}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Scheduled Events</CardTitle>
                    <CardDescription>A list of all events scheduled for your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Venue</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3}>
                                        <Skeleton className="h-10 w-full" />
                                    </TableCell>
                                </TableRow>
                            ) : events.length > 0 ? (
                                events.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{event.title}</TableCell>
                                        <TableCell>{format(event.eventTime.toDate(), 'PPP p')}</TableCell>
                                        <TableCell>{event.venue}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                        No upcoming events scheduled.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
