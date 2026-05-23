
"use client";

import {
  PlusCircle,
  Trash2,
} from "lucide-react"
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea";
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp, orderBy, query } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { format } from "date-fns";


const expenseSchema = z.object({
  category: z.string().min(2, "Category is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  description: z.string().optional(),
});

type Expense = {
    id: string;
    category: string;
    amount: number;
    description?: string;
    date: Timestamp;
}


export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const { toast } = useToast();
  const { db } = useFirebase();

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "",
      amount: 0,
      description: "",
    },
  });

  const fetchExpenses = async () => {
    if (!db) return;
    const expensesCollectionRef = collection(db, "expenses");
    const q = query(expensesCollectionRef, orderBy("date", "desc"));
    try {
        const data = await getDocs(q);
        const fetchedExpenses = data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Expense[];
        setExpenses(fetchedExpenses);
    } catch (error) {
        console.error("Error fetching expenses: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not fetch expenses." });
    }
  }

  useEffect(() => {
    if (db) {
        fetchExpenses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);


  async function onSubmit(values: z.infer<typeof expenseSchema>) {
    if (!db) return;

    const expensesCollectionRef = collection(db, "expenses");
    const newExpenseData = {
        ...values,
        date: Timestamp.now(),
    };
    try {
        await addDoc(expensesCollectionRef, newExpenseData);
        toast({ variant: "success", title: "Success", description: "Expense added successfully." });
        fetchExpenses();
        form.reset();
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error adding expense: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not add expense." });
    }
  }

  async function handleDeleteExpense() {
    if (!db || !expenseToDelete) return;
    const expenseDoc = doc(db, "expenses", expenseToDelete.id);
    try {
        await deleteDoc(expenseDoc);
        toast({ variant: "success", title: "Success", description: "Expense deleted." });
        fetchExpenses();
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete expense." });
    } finally {
        setExpenseToDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>
                Track and manage your business expenses.
                </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                     <Button size="sm" className="h-8 gap-1 shrink-0">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add Expense
                        </span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                    <DialogDescription>
                        Fill in the details for the new expense.
                    </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Category</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Office Supplies" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Amount (₹)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 500" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe the expense..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit">Add Expense</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length > 0 ? expenses.map(expense => (
                  <TableRow key={expense.id}>
                  <TableCell>{format(expense.date.toDate(), "PPP")}</TableCell>
                  <TableCell className="font-medium">{expense.category}</TableCell>
                  <TableCell className="text-muted-foreground">{expense.description}</TableCell>
                  <TableCell className="text-right">₹{expense.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setExpenseToDelete(expense)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Delete expense</span>
                              </Button>
                          </AlertDialogTrigger>
                           <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete this expense record.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteExpense}>Continue</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No expenses found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card grid */}
        <div className="grid gap-3 md:hidden">
          {expenses.length > 0 ? expenses.map(expense => (
            <Card key={expense.id} className="border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-base">{expense.category}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{format(expense.date.toDate(), "PPP")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-semibold text-sm">₹{expense.amount.toFixed(2)}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setExpenseToDelete(expense)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete expense</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this expense record.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteExpense}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              {expense.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{expense.description}</p>
                </CardContent>
              )}
            </Card>
          )) : (
            <p className="text-center text-muted-foreground py-4">No expenses found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
