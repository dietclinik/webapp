
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { useFirebase } from "./firebase-provider";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import { usePathname } from "next/navigation";

type Notification = {
  id: string;
  message: string;
  link: string;
  timestamp: any;
  read: boolean;
};

export function NotificationsPopover({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { db } = useFirebase();
  const pathname = usePathname();

  useEffect(() => {
    if (!db || !userId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
    }, (error) => {
        console.error("Error fetching notifications for popover: ", error);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    if (!db) return;
    const unreadNotifs = notifications.filter(n => !n.read);
    for (const notif of unreadNotifs) {
        const notifRef = doc(db, 'notifications', notif.id);
        await updateDoc(notifRef, { read: true });
    }
  };

    let notificationsLink = '/dashboard/notifications';
    if (pathname.startsWith('/admin')) {
        notificationsLink = '/admin/notifications';
    } else if (pathname.startsWith('/staff')) {
        notificationsLink = '/staff/notifications';
    } else if (pathname.startsWith('/partner')) {
        notificationsLink = '/partner/notifications';
    } else if (pathname.startsWith('/corporate')) {
        notificationsLink = '/corporate/notifications';
    }


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
             <h4 className="font-medium">Notifications</h4>
             {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
                    <CheckCheck className="mr-1 h-3 w-3" />
                    Mark all read
                </Button>
             )}
          </div>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
                <ul className="space-y-1">
                    {notifications.map(notif => (
                        <li key={notif.id}>
                            <Link href={notif.link}>
                                <div className={`block p-2 rounded-md hover:bg-muted ${!notif.read ? 'font-semibold' : 'text-muted-foreground'}`}>
                                    <p className="text-sm leading-snug">{notif.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true }) : ''}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center p-4">No notifications yet.</p>
            )}
        </div>
        <div className="p-2 border-t">
            <Link href={notificationsLink}>
                <Button variant="link" size="sm" className="w-full">View All Notifications</Button>
            </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
