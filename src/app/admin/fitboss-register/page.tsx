
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FitbossRegistration = {
  id: string;
  gymName: string;
  gymOwnerName: string;
  gymLogoUrl: string;
  gymContactNumber: string;
  participantName: string;
  participantAge: number;
  participantWeight: number;
  participantTShirtSize: string;
  paymentStatus: 'Paid' | 'Failed' | 'Pending';
  createdAt: Timestamp;
};

export default function FitbossRegistrationsPage() {
  const [registrations, setRegistrations] = useState<FitbossRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const { db } = useFirebase();

  useEffect(() => {
    if (!db) {
        setLoading(false);
        return;
    }
    const q = query(collection(db, "fitbossRegistrations"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedRegistrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FitbossRegistration));
        setRegistrations(fetchedRegistrations);
        setLoading(false);
      }, 
      (error) => {
        console.error("Error fetching registrations:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6" /> Fitboss Challenge Registrations
        </CardTitle>
        <CardDescription>Registrations from the public Fitboss weight loss challenge form.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <>
            {/* Table — md and above */}
            <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                  <TableRow>
                      <TableHead>Gym Details</TableHead>
                      <TableHead>Participant Details</TableHead>
                      <TableHead>T-Shirt</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Registered On</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {registrations.length > 0 ? registrations.map((reg) => (
                      <TableRow key={reg.id}>
                          <TableCell>
                              <div className="flex items-center gap-3">
                                  <Avatar>
                                      <AvatarImage src={reg.gymLogoUrl} alt={reg.gymName} />
                                      <AvatarFallback>{reg.gymName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                      <div className="font-medium">{reg.gymName}</div>
                                      <div className="text-xs text-muted-foreground">{reg.gymOwnerName}</div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/>{reg.gymContactNumber}</div>
                                  </div>
                              </div>
                          </TableCell>
                           <TableCell>
                             <div className="font-medium">{reg.participantName}</div>
                             <div className="text-xs text-muted-foreground">Age: {reg.participantAge}</div>
                             <div className="text-xs text-muted-foreground">Weight: {reg.participantWeight} kg</div>
                          </TableCell>
                          <TableCell>{reg.participantTShirtSize}</TableCell>
                          <TableCell>
                              <Badge variant={reg.paymentStatus === 'Paid' ? 'success' : 'destructive'}>
                                  {reg.paymentStatus}
                              </Badge>
                          </TableCell>
                          <TableCell>
                               {reg.createdAt ? format(reg.createdAt.toDate(), 'PPP') : 'N/A'}
                          </TableCell>
                      </TableRow>
                  )) : (
                      <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                              No registrations yet.
                          </TableCell>
                      </TableRow>
                  )}
              </TableBody>
            </Table>
            </div>

            {/* Cards — below md */}
            <div className="grid gap-3 md:hidden">
              {registrations.length > 0 ? registrations.map((reg) => (
                <div key={reg.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={reg.gymLogoUrl} alt={reg.gymName} />
                        <AvatarFallback>{reg.gymName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{reg.gymName}</p>
                        <p className="text-xs text-muted-foreground">{reg.gymOwnerName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/>{reg.gymContactNumber}</p>
                      </div>
                    </div>
                    <Badge variant={reg.paymentStatus === 'Paid' ? 'success' : 'destructive'} className="shrink-0">
                      {reg.paymentStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 border-t pt-3 space-y-1">
                    <p className="font-medium text-sm">{reg.participantName}</p>
                    <p className="text-xs text-muted-foreground">Age: {reg.participantAge} &middot; Weight: {reg.participantWeight} kg &middot; T-Shirt: {reg.participantTShirtSize}</p>
                    <p className="text-xs text-muted-foreground">Registered: {reg.createdAt ? format(reg.createdAt.toDate(), 'PP') : 'N/A'}</p>
                  </div>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-12">No registrations yet.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
