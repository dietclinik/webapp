
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, getDocs } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { useToast } from "@/hooks/use-toast";
import { createGoogleMeet } from "@/ai/flows/create-google-meet-flow";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Video } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(5, "Meeting title must be at least 5 characters."),
  description: z.string().optional(),
  recipients: z.array(z.string()).min(1, "You must select at least one recipient."),
});

type User = {
    id: string;
    name: string;
    email: string;
};

export default function MeetingsPage() {
    const [customers, setCustomers] = useState<User[]>([]);
    const [staff, setStaff] = useState<User[]>([]);
    const [partners, setPartners] = useState<User[]>([]);
    const [corporates, setCorporates] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { db } = useFirebase();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            recipients: [],
        },
    });

    useEffect(() => {
        if (!db) return;

        const fetchAllUsers = async () => {
            setLoading(true);
            try {
                const [customersSnap, staffSnap, partnersSnap, corporatesSnap] = await Promise.all([
                    getDocs(collection(db, "customers")),
                    getDocs(collection(db, "staff")),
                    getDocs(collection(db, "vendors")),
                    getDocs(collection(db, "corporates")),
                ]);

                setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, email: doc.data().email })));
                setStaff(staffSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, email: doc.data().email })));
                setPartners(partnersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, email: doc.data().email })));
                setCorporates(corporatesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, email: doc.data().email })));

            } catch (error) {
                console.error("Error fetching users:", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to fetch user lists." });
            } finally {
                setLoading(false);
            }
        };

        fetchAllUsers();
    }, [db, toast]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        try {
            const result = await createGoogleMeet({
                title: data.title,
                description: data.description || "",
                recipientEmails: data.recipients,
            });

            if (result.success) {
                toast({
                    title: "Meeting Created",
                    description: `An invitation has been sent for "${data.title}".`,
                    variant: "success",
                });
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Failed to create meeting",
                description: error.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const UserList = ({ users, userType }: { users: User[], userType: string }) => (
        <ScrollArea className="h-72 w-full rounded-md border">
            <div className="p-4">
                {users.length > 0 ? users.map((user) => (
                    <FormField
                        key={user.id}
                        control={form.control}
                        name="recipients"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(user.email)}
                                        onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...field.value, user.email])
                                                : field.onChange(field.value?.filter(value => value !== user.email));
                                        }}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal w-full">
                                    <div className="flex justify-between">
                                        <span>{user.name}</span>
                                        <span className="text-muted-foreground text-xs">{user.email}</span>
                                    </div>
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                )) : <p className="text-center text-muted-foreground text-sm">No {userType} found.</p>}
            </div>
        </ScrollArea>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create Google Meet</CardTitle>
                <CardDescription>Schedule a new meeting and send invitations to selected users.</CardDescription>
            </CardHeader>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Meeting Title</FormLabel>
                                        <FormControl><Input placeholder="e.g., Weekly Diet Plan Review" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Agenda / Description (Optional)</FormLabel>
                                        <FormControl><Textarea placeholder="Topics to be discussed..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="space-y-4">
                            <Label>Recipients</Label>
                            <Tabs defaultValue="customers">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="customers">Customers</TabsTrigger>
                                    <TabsTrigger value="staff">Staff</TabsTrigger>
                                    <TabsTrigger value="partners">Partners</TabsTrigger>
                                    <TabsTrigger value="corporates">Corporates</TabsTrigger>
                                </TabsList>
                                <TabsContent value="customers">
                                    <UserList users={customers} userType="customers" />
                                </TabsContent>
                                <TabsContent value="staff">
                                     <UserList users={staff} userType="staff" />
                                </TabsContent>
                                <TabsContent value="partners">
                                     <UserList users={partners} userType="partners" />
                                </TabsContent>
                                <TabsContent value="corporates">
                                     <UserList users={corporates} userType="corporates" />
                                </TabsContent>
                            </Tabs>
                            <FormField
                                control={form.control}
                                name="recipients"
                                render={() => <FormMessage />}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting || loading} className="ml-auto">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Video className="mr-2 h-4 w-4" />
                            Create & Send Invite
                        </Button>
                    </CardFooter>
                </form>
             </Form>
        </Card>
    );
}
