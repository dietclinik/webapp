
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Trash2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

type Notification = {
  id: string;
  message: string;
  link: string;
  timestamp: any;
  read: boolean;
};

export default function PartnerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { db, auth } = useFirebase();

  useEffect(() => {
    if (!db || !auth) return;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
            const q = query(
                collection(db, "notifications"),
                where("userId", "==", user.uid),
                orderBy("timestamp", "desc")
            );

            const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
                const notifs = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
                setNotifications(notifs);
            }, (error) => {
                console.error("Error fetching notifications:", error);
            });

            return () => unsubscribeSnapshot();
        } else {
            setNotifications([]);
        }
    });

    return () => unsubscribeAuth();
  }, [db, auth]);

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
        <CardTitle className="text-xl font-bold">My Notifications</CardTitle>
        <CardDescription>Updates and alerts regarding your account and customers.</CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <ul className="space-y-4">
            {notifications.map(notif => (
              <li key={notif.id} className={`flex items-start gap-3 p-3 sm:p-4 rounded-lg border ${!notif.read ? 'bg-primary/5' : 'bg-muted/50'}`}>
                <Bell className="h-5 w-5 mt-1 text-primary shrink-0"/>
                <div className="flex-1 min-w-0 space-y-1">
                   <p className="font-medium text-sm sm:text-base">
                     <Link href={notif.link} className="hover:underline">{notif.message}</Link>
                   </p>
                   <p className="text-xs sm:text-sm text-muted-foreground">
                        {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true }) : '...'}
                   </p>
                   {!notif.read && (
                       <Button variant="outline" size="sm" className="h-7 text-xs sm:hidden mt-1" onClick={() => markAsRead(notif.id)}>Mark as Read</Button>
                   )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {!notif.read && (
                        <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => markAsRead(notif.id)}>Mark as Read</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteNotification(notif.id)} className="text-destructive h-8 w-8">
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
