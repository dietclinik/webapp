
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { LifeBuoy, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = "Open" | "In Progress" | "Closed";

type Ticket = {
  id: string;
  userId: string;
  customerName: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: Timestamp;
};

const statusVariant: Record<TicketStatus, "success" | "default" | "secondary"> = {
  Open: "success",
  "In Progress": "default",
  Closed: "secondary",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { db } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
        setTickets(fetchedTickets);
        setLoading(false);
      },
      (error) => {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: `supportTickets`,
            operation: 'list'
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          console.error("Error fetching support tickets:", error);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!db || !selectedTicket) return;
    setIsUpdatingStatus(true);
    const ticketRef = doc(db, 'supportTickets', selectedTicket.id);
    try {
      await updateDoc(ticketRef, { status: newStatus, updatedAt: Timestamp.now() });
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      toast({ variant: 'success', title: 'Updated', description: `Ticket marked as ${newStatus}.` });
    } catch (e: any) {
      if (e.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: ticketRef.path,
          operation: 'update',
          requestResourceData: { status: newStatus }
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update ticket status.' });
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6" /> Support Tickets
        </CardTitle>
        <CardDescription>Support requests raised by customers.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
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
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length > 0 ? tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">...{ticket.id.slice(-6)}</TableCell>
                    <TableCell className="font-medium">{ticket.customerName}</TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[ticket.status]}>{ticket.status}</Badge>
                    </TableCell>
                    <TableCell className="font-normal">
                      {ticket.createdAt ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(ticket)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No support tickets yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {tickets.length > 0 ? tickets.map(ticket => (
              <Card key={ticket.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{ticket.customerName}</p>
                        <Badge variant={statusVariant[ticket.status]}>{ticket.status}</Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ticket.createdAt ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : 'just now'}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedTicket(ticket)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-center text-muted-foreground py-12">No support tickets yet.</p>
            )}
          </div>
          </>
        )}
      </CardContent>
    </Card>

     <Dialog open={!!selectedTicket} onOpenChange={(isOpen) => !isOpen && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
                From: {selectedTicket?.customerName}
                {selectedTicket?.createdAt && ` · Raised on ${format(selectedTicket.createdAt.toDate(), 'PPP')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm bg-muted/50 p-4 rounded-md whitespace-pre-wrap">{selectedTicket?.description}</p>
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status</span>
                <Select
                    value={selectedTicket?.status}
                    onValueChange={(value) => handleStatusChange(value as TicketStatus)}
                    disabled={isUpdatingStatus}
                >
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
     </Dialog>
    </>
  );
}
