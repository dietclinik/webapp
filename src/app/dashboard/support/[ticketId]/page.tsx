
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/components/firebase-provider';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Loader2, Calendar, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Closed';
  createdAt: Timestamp;
  userId: string;
};

export default function ViewTicketPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;
  const { db, auth } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!db || !auth || !ticketId) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const ticketDocRef = doc(db, 'supportTickets', ticketId);
          const ticketSnap = await getDoc(ticketDocRef);

          if (ticketSnap.exists()) {
            const ticketData = { id: ticketSnap.id, ...ticketSnap.data() } as Ticket;
            if (ticketData.userId === user.uid) {
              setTicket(ticketData);
            } else {
              toast({ variant: 'destructive', title: 'Access Denied', description: "You don't have permission to view this ticket." });
              router.push('/dashboard/support');
            }
          } else {
            toast({ variant: 'destructive', title: 'Not Found', description: 'This support ticket does not exist.' });
            router.push('/dashboard/support');
          }
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load the support ticket.' });
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });
    
    return () => unsubscribe();
  }, [db, auth, ticketId, router, toast]);
  
  if (loading) {
    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-24 w-full" />
            </CardContent>
        </Card>
    );
  }

  if (!ticket) {
    return null; // or a 'not found' component
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/support">
                    <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4" /> Raised on {format(ticket.createdAt.toDate(), 'PPP')}
                    </CardDescription>
                </div>
            </div>
            <Badge variant={ticket.status === 'Closed' ? 'secondary' : 'default'} className="flex items-center gap-1">
                 <Circle className={`h-2 w-2 ${ticket.status === 'Open' ? 'fill-green-500' : 'fill-gray-500'}`} />
                {ticket.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose dark:prose-invert max-w-none bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold">Your message:</h3>
            <p>{ticket.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
