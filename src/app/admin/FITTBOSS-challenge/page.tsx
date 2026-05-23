
"use client";

import { PlusCircle, Pencil, Trash2, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, deleteDoc, doc, onSnapshot, orderBy, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deletePartner } from "@/ai/flows/delete-partner-flow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type FitbossGym = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  maxCustomers?: number;
};

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

export default function FitbossChallengePage() {
  const [gyms, setGyms] = useState<FitbossGym[]>([]);
  const [registrations, setRegistrations] = useState<FitbossRegistration[]>([]);
  const [gymToDelete, setGymToDelete] = useState<FitbossGym | null>(null);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);
  const { toast } = useToast();
  const { db } = useFirebase();

  useEffect(() => {
    if (!db) return;

    const fetchGyms = async () => {
      setLoadingGyms(true);
      try {
        const q = query(collection(db, "vendors"), where("challenge", "==", "FITTBOSS"));
        const snapshot = await getDocs(q);
        const fetchedGyms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FitbossGym));
        setGyms(fetchedGyms);
      } catch (error: any) {
        console.error("Error fetching gyms: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch gym data." });
      } finally {
        setLoadingGyms(false);
      }
    };
    
    const subscribeToRegistrations = () => {
        setLoadingRegistrations(true);
        const q = query(collection(db, "fitbossRegistrations"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const fetchedRegistrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FitbossRegistration));
            setRegistrations(fetchedRegistrations);
            setLoadingRegistrations(false);
          }, 
          (error) => {
            console.error("Error fetching registrations:", error);
            setLoadingRegistrations(false);
          }
        );
        return unsubscribe;
    };

    fetchGyms();
    const unsubscribeRegistrations = subscribeToRegistrations();

    return () => {
        unsubscribeRegistrations();
    };
  }, [db, toast]);

  const handleDeleteGym = async () => {
    if (!gymToDelete) return;
    try {
        const result = await deletePartner({ partnerId: gymToDelete.id });
        if (result.success) {
            toast({ variant: "success", title: "Success", description: "Gym deleted successfully." });
            setGyms(prev => prev.filter(gym => gym.id !== gymToDelete.id));
        } else {
             throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: `Could not delete gym: ${error.message}` });
    } finally {
        setGymToDelete(null);
    }
  };

  const loading = loadingGyms || loadingRegistrations;

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>FITTBOSS Challenge Gyms</CardTitle>
            <CardDescription>Manage gyms participating in the FITTBOSS Challenge.</CardDescription>
          </div>
          <Link href="/admin/FITTBOSS-challenge/add">
            <Button size="sm" className="h-10 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Gym</span>
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gym Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Customer Limit</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingGyms ? (
                [...Array(2)].map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10" /></TableCell></TableRow>
                ))
              ) : gyms.length > 0 ? (
                gyms.map((gym) => (
                  <TableRow key={gym.id}>
                    <TableCell className="font-medium">{gym.name}</TableCell>
                    <TableCell>
                      <div>{gym.email}</div>
                      <div className="text-sm text-muted-foreground">{gym.mobile}</div>
                    </TableCell>
                    <TableCell>{gym.maxCustomers}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => alert('Edit functionality coming soon!')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setGymToDelete(gym)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete the gym account. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setGymToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGym}>Continue</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center">No gyms added to the challenge yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Mobile Cards */}
        <div className="grid gap-3 md:hidden">
          {loadingGyms ? (
            [...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)
          ) : gyms.length > 0 ? gyms.map(gym => (
            <Card key={gym.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{gym.name}</p>
                    <p className="text-sm text-muted-foreground">{gym.email}</p>
                    {gym.mobile && <p className="text-sm text-muted-foreground">{gym.mobile}</p>}
                    {gym.maxCustomers && <p className="text-xs text-muted-foreground mt-1">Limit: {gym.maxCustomers} customers</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => alert('Edit functionality coming soon!')}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGymToDelete(gym)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the gym account. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setGymToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteGym}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-center text-muted-foreground py-8">No gyms added to the challenge yet.</p>
          )}
        </div>
      </CardContent>
    </Card>

     <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6" /> FITTBOSS Challenge Registrations
        </CardTitle>
        <CardDescription>Registrations from the public FITTBOSS weight loss challenge form.</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingRegistrations ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym Details</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>T-Shirt</TableHead>
                  <TableHead>Payment</TableHead>
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{reg.participantName}</div>
                      <div className="text-xs text-muted-foreground">Age: {reg.participantAge} · {reg.participantWeight} kg</div>
                    </TableCell>
                    <TableCell>{reg.participantTShirtSize}</TableCell>
                    <TableCell>
                      <Badge variant={reg.paymentStatus === 'Paid' ? 'success' : 'destructive'}>{reg.paymentStatus}</Badge>
                    </TableCell>
                    <TableCell>{reg.createdAt ? format(reg.createdAt.toDate(), 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No registrations yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {registrations.length > 0 ? registrations.map(reg => (
              <Card key={reg.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={reg.gymLogoUrl} alt={reg.gymName} />
                      <AvatarFallback>{reg.gymName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{reg.gymName}</p>
                      <p className="text-xs text-muted-foreground">{reg.gymOwnerName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Participant: </span><span className="font-medium">{reg.participantName}</span></div>
                    <div><span className="text-muted-foreground">Age: </span>{reg.participantAge}</div>
                    <div><span className="text-muted-foreground">Weight: </span>{reg.participantWeight} kg</div>
                    <div><span className="text-muted-foreground">T-Shirt: </span>{reg.participantTShirtSize}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={reg.paymentStatus === 'Paid' ? 'success' : 'destructive'}>{reg.paymentStatus}</Badge>
                    <span className="text-xs text-muted-foreground">{reg.createdAt ? format(reg.createdAt.toDate(), 'PP') : 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-center text-muted-foreground py-12">No registrations yet.</p>
            )}
          </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
