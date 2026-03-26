
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Calendar as CalendarIcon, Check, X, Eye } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, runTransaction, Timestamp, onSnapshot } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  name: string;
  attendance: { [date: string]: 'present' | 'absent' };
};

export default function MoneyBackChallengePage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setLoading(true);
            const q = query(
                collection(db, "customers"),
                where("vendorId", "==", user.uid),
                where("moneyBackChallenge", "==", true)
            );
            
            const snapshotUnsubscribe = onSnapshot(q, (querySnapshot) => {
                const fetchedParticipants = querySnapshot.docs.map(doc => ({ 
                    id: doc.id,
                    name: doc.data().name,
                    attendance: doc.data().attendance || {},
                 }));
                setParticipants(fetchedParticipants);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching participants:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch participants." });
                setLoading(false);
            });
            
            return () => snapshotUnsubscribe();
        } else {
            setParticipants([]);
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, [auth, db, toast]);

  const handleAttendanceChange = async (participantId: string, status: 'present' | 'absent' | 'unset') => {
    if (!db) return;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const participantDocRef = doc(db, 'customers', participantId);

    try {
        await runTransaction(db, async (transaction) => {
            const participantDoc = await transaction.get(participantDocRef);
            if (!participantDoc.exists()) {
                throw new Error("Participant not found!");
            }
            const currentAttendance = participantDoc.data().attendance || {};
            
            if (status === 'unset') {
                delete currentAttendance[dateKey];
            } else {
                currentAttendance[dateKey] = status;
            }

            transaction.update(participantDocRef, { attendance: currentAttendance });
        });
    } catch (e: any) {
        console.error("Failed to update attendance:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update attendance.' });
    }
  };

  const getAttendanceForDate = (participant: Participant, date: Date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return participant.attendance?.[dateKey];
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-primary"/> Money Back Challenge</CardTitle>
            <CardDescription>Mark daily attendance for your challenge participants.</CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead className="text-center">Attendance for {format(selectedDate, 'PPP')}</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-48 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-8 rounded-full mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : participants.length > 0 ? (
              participants.map(p => {
                const attendanceStatus = getAttendanceForDate(p, selectedDate);
                return (
                    <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                           <div className="flex justify-center items-center gap-2">
                                <Button 
                                    variant={attendanceStatus === 'present' ? 'default' : 'outline'}
                                    size="icon" 
                                    onClick={() => handleAttendanceChange(p.id, 'present')}
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant={attendanceStatus === 'absent' ? 'destructive' : 'outline'}
                                    size="icon" 
                                    onClick={() => handleAttendanceChange(p.id, 'absent')}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                {attendanceStatus && (
                                     <Button 
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => handleAttendanceChange(p.id, 'unset')}
                                    >
                                        Clear
                                    </Button>
                                )}
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                            <Link href={`/partner/money-back-challenge/view/${p.id}`}>
                                <Button variant="outline" size="icon">
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View Details</span>
                                </Button>
                            </Link>
                        </TableCell>
                    </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">No customers are enrolled in the challenge yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
