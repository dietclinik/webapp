
"use client";

import { useState, useEffect } from 'react';
import { useFirebase } from '@/components/firebase-provider';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

type Meeting = {
    id: string;
    title: string;
    description: string;
    meetLink: string;
    createdAt: Timestamp;
};

export default function CorporateMyMeetingsPage() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const { auth, db } = useFirebase();

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user?.email) {
                setLoading(true);
                const meetingsQuery = query(
                    collection(db, 'meetings'),
                    where('participantEmails', 'array-contains', user.email),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(meetingsQuery);
                const fetchedMeetings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
                setMeetings(fetchedMeetings);
                setLoading(false);
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();

    }, [auth, db]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>My Meetings</CardTitle>
                <CardDescription>A list of all meetings you have been invited to.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Date Created</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center">Loading meetings...</TableCell></TableRow>
                        ) : meetings.length > 0 ? (
                            meetings.map(meeting => (
                                <TableRow key={meeting.id}>
                                    <TableCell className="font-medium">{meeting.title}</TableCell>
                                    <TableCell>{format(meeting.createdAt.toDate(), 'PPP p')}</TableCell>
                                    <TableCell>
                                        <Link href={`/corporate/meetings/join/${meeting.id}`}>
                                            <Button variant="outline" size="sm">
                                                <Video className="mr-2 h-4 w-4" />
                                                Join Meeting
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={3} className="text-center">You have no upcoming meetings.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
