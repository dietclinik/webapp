
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Trash2 } from "lucide-react";

type Notification = {
  id: string;
  message: string;
  link: string;
  timestamp: any;
  read: boolean;
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { db } = useFirebase();

  useEffect(() => {
    if (!db) return;
    
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", "admin"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
      setNotifications(notifs);
    }, (error) => {
        console.error("Error fetching notifications:", error);
    });

    return () => unsubscribe();
  }, [db]);

  const markAsRead = async (id: string) => {
    if (!db) return;
    const notifRef = doc(db, "notifications", id);
    await updateDoc(notifRef, { read: true });
  };

  const deleteNotification = async (id: string) => {
     if (!db) return;
    const notifRef = doc(db, "notifications", id);
    await deleteDoc(notifRef);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Notifications</CardTitle>
        <CardDescription>Here are all the recent updates and alerts.</CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <ul className="space-y-4">
            {notifications.map(notif => (
              <li key={notif.id} className={`flex items-start gap-4 p-4 rounded-lg border ${!notif.read ? 'bg-primary/5' : 'bg-muted/50'}`}>
                <Bell className="h-5 w-5 mt-1 text-primary"/>
                <div className="flex-1 space-y-1">
                   <p className="font-medium">
                     <Link href={notif.link} className="hover:underline">{notif.message}</Link>
                   </p>
                   <p className="text-sm text-muted-foreground">
                        {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true }) : '...'}
                   </p>
                </div>
                <div className="flex gap-2">
                    {!notif.read && (
                        <Button variant="outline" size="sm" onClick={() => markAsRead(notif.id)}>Mark as Read</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteNotification(notif.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-center">No notifications yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
