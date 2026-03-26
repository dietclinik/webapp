
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Calendar, MapPin, Clipboard, Check } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Input } from "@/components/ui/input";

type EventData = {
    title: string;
    description?: string;
    venue: string;
    eventTime: Timestamp;
    corporateId: string;
    status: 'Upcoming' | 'Completed' | 'Cancelled';
};

type Registration = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    registeredAt: Timestamp;
};

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base">{value || 'N/A'}</p>
        </div>
    </div>
);

export default function ViewCorporateEventPage() {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventData | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  useEffect(() => {
    if (!db || !eventId || !auth) return;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
            const fetchData = async () => {
              setLoading(true);
              try {
                const eventDocRef = doc(db, "corporateEvents", eventId);
                const eventSnap = await getDoc(eventDocRef);

                if (eventSnap.exists() && eventSnap.data().corporateId === user.uid) {
                  setEvent(eventSnap.data() as EventData);
                  
                  const registrationsQuery = query(collection(db, `corporateEvents/${eventId}/registrations`), orderBy("registeredAt", "desc"));
                  
                  const unsubscribeRegistrations = onSnapshot(registrationsQuery, 
                    (snapshot) => {
                        const fetchedRegistrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
                        setRegistrations(fetchedRegistrations);
                    },
                    (error) => {
                        if (error.code === 'permission-denied') {
                            const permissionError = new FirestorePermissionError({
                                path: `corporateEvents/${eventId}/registrations`,
                                operation: 'list'
                            });
                            errorEmitter.emit('permission-error', permissionError);
                        } else {
                            console.error("Error fetching registrations:", error);
                            toast({ variant: 'destructive', title: 'Error', description: 'Could not load registrations.' });
                        }
                    }
                  );
                  // Returning this from the auth listener's async function doesn't work as expected for cleanup.
                  // We'll let it detach when the component unmounts.

                } else {
                  toast({ variant: "destructive", title: "Error", description: "Event not found or you do not have permission to view it." });
                  router.push('/corporate/events');
                }
              } catch (error) {
                console.error("Error fetching event data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not fetch event data." });
              } finally {
                setLoading(false);
              }
            };
            fetchData();
        } else {
            router.push('/corporate/login');
        }
    });

    return () => unsubscribeAuth();
  }, [db, eventId, auth, toast, router]);

  const registrationLink = `https://app.dietclinik.com/events/register/${eventId}`;
  const copyToClipboard = () => {
      navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    );
  }

  if (!event) {
    return <p>No event data to display.</p>
  }

  return (
    <div className="space-y-6">
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/corporate/events">
                        <Button variant="outline" size="icon">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        </Link>
                        <div>
                        <CardTitle className="text-2xl">{event.title}</CardTitle>
                        <CardDescription>Event details and registration list.</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg">Event Details</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <DetailItem icon={Calendar} label="Date & Time" value={format(event.eventTime.toDate(), 'PPP p')} />
                        <DetailItem icon={MapPin} label="Venue" value={event.venue} />
                         {event.description && (
                            <div className="md:col-span-2">
                                <DetailItem icon={MapPin} label="Description" value={event.description} />
                            </div>
                         )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Registration Link</CardTitle>
                        <CardDescription>Share this link with your employees to let them register for the event.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-2">
                        <Input value={registrationLink} readOnly />
                        <Button variant="outline" onClick={copyToClipboard}>
                            {copied ? <Check className="h-4 w-4 mr-2" /> : <Clipboard className="h-4 w-4 mr-2" />}
                            {copied ? 'Copied!' : 'Copy'}
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Registered Employees ({registrations.length})</CardTitle>
                        <CardDescription>The list of employees who have registered for this event.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Registered On</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrations.length > 0 ? (
                                registrations.map(reg => (
                                    <TableRow key={reg.id}>
                                    <TableCell>{reg.name}</TableCell>
                                    <TableCell>{reg.email}</TableCell>
                                    <TableCell>{reg.mobile}</TableCell>
                                    <TableCell>{format(reg.registeredAt.toDate(), 'PPP')}</TableCell>
                                    </TableRow>
                                ))
                                ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">No registrations yet.</TableCell>
                                </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    </div>
  );
}
