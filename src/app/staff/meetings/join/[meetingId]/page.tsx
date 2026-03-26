
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";

type Meeting = {
    title: string;
    meetLink: string;
};

export default function JoinMeetingPage() {
    const params = useParams();
    const meetingId = params.meetingId as string;
    const { db } = useFirebase();
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db || !meetingId) return;

        const fetchMeeting = async () => {
            setLoading(true);
            const meetingDocRef = doc(db, "meetings", meetingId);
            const docSnap = await getDoc(meetingDocRef);
            if (docSnap.exists()) {
                setMeeting(docSnap.data() as Meeting);
            }
            setLoading(false);
        };
        fetchMeeting();
    }, [db, meetingId]);

    if (loading) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-1/4 mb-4" />
                <Skeleton className="h-[70vh] w-full" />
            </div>
        )
    }

    if (!meeting) {
        return (
             <div className="p-8">
                <h1 className="text-2xl font-bold mb-4">Meeting Not Found</h1>
                <p>The meeting you are looking for could not be found or has been cancelled.</p>
            </div>
        )
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-background">
             <Header variant="dark" />
             <main className="flex-1 flex flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-semibold">{meeting.title}</h1>
                </div>
                <iframe
                    src={meeting.meetLink.replace('/lookup/', '/embed/')}
                    allow="camera; microphone; fullscreen; display-capture"
                    className="w-full h-full border-0"
                ></iframe>
            </main>
        </div>
    );
}
