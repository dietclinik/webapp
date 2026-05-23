
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MailOpen, Eye, Trash2 } from "lucide-react";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";

type Submission = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  subject: string;
  message: string;
  createdAt: Timestamp;
  isRead: boolean;
};

export default function ContactSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const { db } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (!db) {
        setLoading(false);
        return;
    }
    const q = query(collection(db, "contactSubmissions"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedSubmissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        setSubmissions(fetchedSubmissions);
        setLoading(false);
      }, 
      (error) => {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: `contactSubmissions`,
            operation: 'list'
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
           console.error("Error fetching contact submissions:", error);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  const handleViewClick = (submission: Submission) => {
      setSelectedSubmission(submission);
      if(!submission.isRead) {
          markAsRead(submission.id);
      }
  }

  const markAsRead = async (id: string) => {
    if(!db) return;
    const submissionRef = doc(db, 'contactSubmissions', id);
    try {
        await updateDoc(submissionRef, { isRead: true });
    } catch(e: any) {
       if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: submissionRef.path,
                operation: 'update',
                requestResourceData: { isRead: true }
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             console.error("Failed to mark as read:", e);
        }
    }
  }

  const handleDelete = async () => {
      if(!db || !submissionToDelete) return;
      const submissionRef = doc(db, 'contactSubmissions', submissionToDelete.id);
      try {
        await deleteDoc(submissionRef);
        toast({ title: 'Success', description: 'Submission deleted successfully.' });
      } catch(e: any) {
         toast({ variant: 'destructive', title: 'Error', description: 'Could not delete submission.' });
      } finally {
        setSubmissionToDelete(null);
      }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <MailOpen className="h-6 w-6" /> Contact Form Submissions
        </CardTitle>
        <CardDescription>Messages sent from the public contact page.</CardDescription>
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
                  <TableHead>S.No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length > 0 ? submissions.map((submission, index) => (
                  <TableRow key={submission.id} className={!submission.isRead ? 'font-bold' : ''}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {submission.isRead ? <Badge variant="secondary">Viewed</Badge> : <Badge variant="success">New</Badge>}
                    </TableCell>
                    <TableCell>
                      <div>{submission.name}</div>
                      <div className="text-xs text-muted-foreground font-normal">{submission.email}</div>
                    </TableCell>
                    <TableCell>{submission.subject}</TableCell>
                    <TableCell className="font-normal">
                      {submission.createdAt ? formatDistanceToNow(submission.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleViewClick(submission)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setSubmissionToDelete(submission)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this message.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setSubmissionToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No contact submissions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {submissions.length > 0 ? submissions.map(submission => (
              <Card key={submission.id} className={!submission.isRead ? 'border-primary/40 bg-primary/5' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{submission.name}</p>
                        {submission.isRead ? <Badge variant="secondary">Viewed</Badge> : <Badge variant="success">New</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{submission.email}</p>
                      <p className="text-sm font-medium mt-1">{submission.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{submission.createdAt ? formatDistanceToNow(submission.createdAt.toDate(), { addSuffix: true }) : 'just now'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewClick(submission)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSubmissionToDelete(submission)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this message.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setSubmissionToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-center text-muted-foreground py-12">No contact submissions yet.</p>
            )}
          </div>
          </>
        )}
      </CardContent>
    </Card>

     <Dialog open={!!selectedSubmission} onOpenChange={(isOpen) => !isOpen && setSelectedSubmission(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSubmission?.subject}</DialogTitle>
            <DialogDescription>
                From: {selectedSubmission?.name} &lt;{selectedSubmission?.email}&gt;
                {selectedSubmission?.mobile && ` | Mobile: ${selectedSubmission.mobile}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm bg-muted/50 p-4 rounded-md">{selectedSubmission?.message}</p>
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
