
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Plus, Minus, Trophy } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, Timestamp, getDocs, doc, runTransaction, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

type Customer = {
  id: string;
  name: string;
  email: string;
  score?: number;
};

export default function EventScoreboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointChanges, setPointChanges] = useState<{ [key: string]: number }>({});
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const fetchCustomers = async (userId: string) => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "customers"), where("corporateId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedCustomers = await Promise.all(
        querySnapshot.docs.map(async (customerDoc) => {
          const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;
          const scoreDocRef = doc(db, `customers/${customerDoc.id}/scores`, "event");
          const scoreSnap = await getDoc(scoreDocRef);
          customerData.score = scoreSnap.exists() ? scoreSnap.data().points : 0;
          return customerData;
        })
      );
      fetchedCustomers.sort((a,b) => (b.score || 0) - (a.score || 0));
      setCustomers(fetchedCustomers);
    } catch (error) {
       console.error("Error fetching customers:", error);
       toast({ variant: 'destructive', title: "Error", description: `Could not fetch customers: ${(error as Error).message}` });
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    };
    
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchCustomers(user.uid);
      } else {
        setCustomers([]);
        setLoading(false);
      }
    });

    return () => authUnsubscribe();
  }, [auth, db, toast]);
  
  const handlePointChange = (customerId: string, value: string) => {
      const numberValue = parseInt(value, 10);
      setPointChanges(prev => ({
          ...prev,
          [customerId]: isNaN(numberValue) ? 0 : numberValue
      }));
  }

  const handleUpdateScore = async (customerId: string, amount: number) => {
    if (!db) return;
    const scoreDocRef = doc(db, `customers/${customerId}/scores`, "event");

    try {
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreDocRef);
            const currentPoints = scoreDoc.exists() ? scoreDoc.data().points : 0;
            const newPoints = currentPoints + amount;
            transaction.set(scoreDocRef, { points: newPoints }, { merge: true });
        });

        setCustomers(prevCustomers => 
            prevCustomers
                .map(c => c.id === customerId ? { ...c, score: (c.score || 0) + amount } : c)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
        );
        toast({ title: 'Success', description: 'Points updated successfully.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update points.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-primary"/> Event Scoreboard</CardTitle>
                <CardDescription>
                Update points for your event participants.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Current Points</TableHead>
              <TableHead className="text-center">Update Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : customers.length > 0 ? (
              customers.map((customer, index) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  </TableCell>
                  <TableCell className="font-bold text-primary">{customer.score}</TableCell>
                   <TableCell>
                       <div className="flex items-center gap-2 justify-center">
                            <Button size="icon" variant="outline" onClick={() => handleUpdateScore(customer.id, -(pointChanges[customer.id] || 1))}>
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                                type="number"
                                className="w-20 text-center"
                                placeholder="1"
                                value={pointChanges[customer.id] || ''}
                                onChange={(e) => handlePointChange(customer.id, e.target.value)}
                            />
                            <Button size="icon" variant="outline" onClick={() => handleUpdateScore(customer.id, pointChanges[customer.id] || 1)}>
                                <Plus className="h-4 w-4" />
                            </Button>
                       </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No customers found for your corporate account.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
