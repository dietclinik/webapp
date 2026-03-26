
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Trophy, ChevronLeft, Save } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, doc, runTransaction, getDoc, writeBatch } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useParams, useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";

type Participant = {
  id: string;
  name: string;
  initialWeight: number;
  finalWeight?: number;
  attendance?: number;
  activityPoints?: number;
  weightLossPercent?: number;
  weightLossPoints?: number;
  activityScore?: number;
  attendanceScore?: number;
  finalScore?: number;
};

export default function EventScoreboardPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [eventDetails, setEventDetails] = useState({ totalDays: 1, maxActivityPoints: 100 });
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const fetchParticipants = async (userId: string) => {
    if (!db || !eventId) return;
    setLoading(true);
    try {
      const registrationsQuery = query(collection(db, `corporateEvents/${eventId}/registrations`));
      const registrationsSnapshot = await getDocs(registrationsQuery);
      
      const fetchedParticipants = await Promise.all(
        registrationsSnapshot.docs.map(async (regDoc) => {
          const regData = regDoc.data();
          const userProfileDoc = await getDoc(doc(db, "userProfiles", regData.userId));
          const scoreDoc = await getDoc(doc(db, `corporateEvents/${eventId}/registrations/${regDoc.id}/scores`, "final"));
          
          return {
            id: regDoc.id,
            name: regData.name,
            initialWeight: userProfileDoc.exists() ? Number(userProfileDoc.data().weight) : 0,
            finalWeight: scoreDoc.exists() ? scoreDoc.data().finalWeight : undefined,
            attendance: scoreDoc.exists() ? scoreDoc.data().attendance : undefined,
            activityPoints: scoreDoc.exists() ? scoreDoc.data().activityPoints : undefined,
          } as Participant;
        })
      );
      
      calculateScores(fetchedParticipants);

    } catch (error) {
       console.error("Error fetching participants:", error);
       toast({ variant: 'destructive', title: "Error", description: `Could not fetch participants: ${(error as Error).message}` });
    } finally {
        setLoading(false);
    }
  };

  const calculateScores = (currentParticipants: Participant[]) => {
      const maxWeightLossPercent = Math.max(0.001, ...currentParticipants.map(p => {
          if (p.initialWeight > 0 && p.finalWeight && p.finalWeight > 0) {
              return ((p.initialWeight - p.finalWeight) / p.initialWeight);
          }
          return 0;
      }));

      const scoredParticipants = currentParticipants.map(p => {
          const weightLossPercent = p.initialWeight > 0 && p.finalWeight && p.finalWeight > 0 
              ? ((p.initialWeight - p.finalWeight) / p.initialWeight)
              : 0;

          const weightLossPoints = (Math.max(0, weightLossPercent) / maxWeightLossPercent) * 100;
          const activityScore = ((p.activityPoints || 0) / eventDetails.maxActivityPoints) * 100;
          const attendanceScore = ((p.attendance || 0) / eventDetails.totalDays) * 100;
          
          const finalScore = (0.60 * weightLossPoints) + (0.30 * activityScore) + (0.10 * attendanceScore);

          return {
              ...p,
              weightLossPercent: weightLossPercent * 100,
              weightLossPoints,
              activityScore,
              attendanceScore,
              finalScore,
          };
      });

      scoredParticipants.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
      setParticipants(scoredParticipants);
  };
  
  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    };
    
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchParticipants(user.uid);
      } else {
        router.push("/corporate/login");
      }
    });

    return () => authUnsubscribe();
  }, [auth, db, eventId, eventDetails]);

  const handleInputChange = (id: string, field: 'finalWeight' | 'attendance' | 'activityPoints', value: string) => {
    const numValue = Number(value);
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: isNaN(numValue) ? undefined : numValue } : p));
  };
  
  const handleSaveAll = async () => {
    if (!db) return;
    setIsSaving(true);
    
    try {
        const batch = writeBatch(db);
        participants.forEach(p => {
            const scoreDocRef = doc(db, `corporateEvents/${eventId}/registrations/${p.id}/scores`, "final");
            batch.set(scoreDocRef, {
                finalWeight: p.finalWeight || null,
                attendance: p.attendance || null,
                activityPoints: p.activityPoints || null,
                weightLossPoints: p.weightLossPoints || 0,
                activityScore: p.activityScore || 0,
                attendanceScore: p.attendanceScore || 0,
                finalScore: p.finalScore || 0,
            }, { merge: true });
        });
        await batch.commit();
        toast({ title: 'Success', description: 'All scores have been saved successfully!' });
    } catch(e) {
        console.error("Failed to save scores:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save scores.' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                 <Link href="/corporate/events">
                    <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
                 </Link>
                <div>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-primary"/> Event Scoreboard</CardTitle>
                    <CardDescription>Update points for your event participants.</CardDescription>
                </div>
            </div>
            <Button onClick={handleSaveAll} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4"/>
                Save All
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
            <div className="space-y-2">
                <Label>Total Event Days</Label>
                <Input type="number" value={eventDetails.totalDays} onChange={(e) => setEventDetails(prev => ({...prev, totalDays: Number(e.target.value) || 1}))} />
            </div>
             <div className="space-y-2">
                <Label>Max Activity Points</Label>
                <Input type="number" value={eventDetails.maxActivityPoints} onChange={(e) => setEventDetails(prev => ({...prev, maxActivityPoints: Number(e.target.value) || 100}))} />
            </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Final Weight</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Activity Points</TableHead>
              <TableHead>Final Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : participants.length > 0 ? (
              participants.map((p, index) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Initial: {p.initialWeight.toFixed(1)} kg</div>
                  </TableCell>
                  <TableCell><Input type="number" placeholder="kg" value={p.finalWeight || ''} onChange={(e) => handleInputChange(p.id, 'finalWeight', e.target.value)} className="w-24"/></TableCell>
                  <TableCell><Input type="number" placeholder="days" value={p.attendance || ''} onChange={(e) => handleInputChange(p.id, 'attendance', e.target.value)} className="w-24"/></TableCell>
                  <TableCell><Input type="number" placeholder="points" value={p.activityPoints || ''} onChange={(e) => handleInputChange(p.id, 'activityPoints', e.target.value)} className="w-24"/></TableCell>
                  <TableCell className="font-bold text-primary text-lg">{p.finalScore?.toFixed(2) || '0.00'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No participants registered for this event.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
