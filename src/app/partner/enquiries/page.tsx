
"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/components/firebase-provider";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FileQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Enquiry = {
    id: string;
    customerName: string;
    customerEmail: string;
    customerMobile: string;
    age: number;
    gender: 'male' | 'female';
    height: number;
    weight: number;
    calculatedBmi: string;
    calculatedCalories: number;
    createdAt: Timestamp;
};

export default function EnquiriesPage() {
    const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setLoading(true);
                const q = query(
                    collection(db, "partnerEnquiries"),
                    where("partnerId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );

                const unsubSnapshot = onSnapshot(q, (snapshot) => {
                    const fetchedEnquiries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enquiry));
                    setEnquiries(fetchedEnquiries);
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching enquiries:", error);
                    setLoading(false);
                });
                return unsubSnapshot;
            } else {
                setEnquiries([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [auth, db]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileQuestion /> Customer Enquiries</CardTitle>
                <CardDescription>A log of all health calculations you've performed for potential customers.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Health Snapshot</TableHead>
                            <TableHead>Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : enquiries.length > 0 ? (
                            enquiries.map((enquiry) => (
                                <TableRow key={enquiry.id}>
                                    <TableCell className="font-medium">{enquiry.customerName}</TableCell>
                                    <TableCell>
                                        <div>{enquiry.customerEmail}</div>
                                        <div className="text-xs text-muted-foreground">{enquiry.customerMobile}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">BMI: {enquiry.calculatedBmi}</Badge>
                                            <Badge variant="secondary">Calories: {enquiry.calculatedCalories?.toFixed(0)}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(enquiry.createdAt.toDate(), 'PPP')}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">You have no enquiries yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
