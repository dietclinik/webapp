
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Send, Loader2, Users, Search, Venus, Mars } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirebase } from '@/components/firebase-provider';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendBulkEmail } from '@/ai/flows/send-bulk-email-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import 'suneditor/dist/css/suneditor.min.css';

const SunEditor = dynamic(() => import("suneditor-react"), {
  ssr: false,
});

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const emailFormSchema = z.object({
    subject: z.string().min(5, "Subject must be at least 5 characters."),
    body: z.string().min(20, "Email body must be at least 20 characters."),
    imageUrl: z.string().url().optional().or(z.literal('')),
    attachment: z.instanceof(File).optional(),
});

type Customer = {
    id: string;
    name: string;
    email: string;
}

export default function BulkEmailPage() {
    const [isSending, setIsSending] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [targetAudience, setTargetAudience] = useState<'all' | 'selective' | 'external'>('all');
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [externalEmails, setExternalEmails] = useState('');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');

    const { toast } = useToast();
    const { db } = useFirebase();

    const form = useForm<z.infer<typeof emailFormSchema>>({
        resolver: zodResolver(emailFormSchema),
        defaultValues: {
            subject: "",
            body: "",
            imageUrl: "",
        },
    });

    useEffect(() => {
        if (!db) return;
        const fetchCustomers = async () => {
            setLoadingCustomers(true);
            try {
                const customersQuery = query(collection(db, 'customers'), where('status', '==', 'Active'));
                const snapshot = await getDocs(customersQuery);
                
                const customerList = snapshot.docs.map(customerDoc => {
                    const customerData = customerDoc.data();
                    return {
                        id: customerDoc.id,
                        name: customerData.name,
                        email: customerData.email,
                    } as Customer;
                });
                
                setCustomers(customerList);

            } catch (error) {
                console.error("Error fetching customers:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch customers.' });
            } finally {
                setLoadingCustomers(false);
            }
        };
        fetchCustomers();
    }, [db, toast]);

    const getRecipientList = () => {
        let internalRecipients: Customer[] = [];
        switch (targetAudience) {
            case 'all':
                internalRecipients = customers;
                break;
            case 'selective':
                internalRecipients = customers.filter(c => selectedCustomers.includes(c.id));
                break;
            default:
                break;
        }

        const externalRecipientList = externalEmails
            .split(/[\n,;]+/)
            .map(email => email.trim())
            .filter(email => email)
            .map(email => ({ name: email.split('@')[0], email }));

        const allRecipients = [
            ...internalRecipients.map(c => ({ name: c.name, email: c.email })),
            ...externalRecipientList
        ];

        // Deduplicate
        const uniqueRecipients = Array.from(new Map(allRecipients.map(item => [item.email, item])).values());
        
        return uniqueRecipients;
    }

    const onSubmit = async (data: z.infer<typeof emailFormSchema>) => {
        setIsSending(true);
        const recipients = getRecipientList();

        if (recipients.length === 0) {
            toast({ variant: 'destructive', title: "No Recipients", description: "Please select at least one recipient." });
            setIsSending(false);
            return;
        }

        let attachmentData;
        if(data.attachment) {
            attachmentData = {
                filename: data.attachment.name,
                content: await fileToBase64(data.attachment),
            }
        }

        try {
            const result = await sendBulkEmail({
                recipients: recipients,
                subject: data.subject,
                body: data.body,
                imageUrl: data.imageUrl,
                attachment: attachmentData,
            });

            if (result.success) {
                toast({
                    title: "Emails Queued!",
                    description: `Your bulk email campaign to ${result.sentCount} recipients has been started.`,
                    variant: "success",
                });
                form.reset();
                setSelectedCustomers([]);
                setExternalEmails('');
            } else {
                 throw new Error(result.message);
            }
        } catch(e: any) {
             toast({ variant: "destructive", title: "Failed to Send", description: e.message });
        } finally {
            setIsSending(false);
        }
    };
    
    const filteredSelectiveCustomers = useMemo(() => {
        if (!customerSearchQuery) {
            return customers;
        }
        return customers.filter(customer => 
            customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
            customer.email.toLowerCase().includes(customerSearchQuery.toLowerCase())
        );
    }, [customers, customerSearchQuery]);

    const handleSelectAll = (checked: boolean) => {
        if(checked) {
            setSelectedCustomers(filteredSelectiveCustomers.map(c => c.id));
        } else {
            setSelectedCustomers([]);
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Link href="/admin/marketing">
                        <Button variant="outline" size="icon">
                        <ChevronLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <CardTitle>Send Bulk Email</CardTitle>
                        <CardDescription>Compose and send an email to a targeted group of customers.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Target Audience</CardTitle></CardHeader>
                            <CardContent>
                                <RadioGroup value={targetAudience} onValueChange={(v) => setTargetAudience(v as any)} className="flex flex-wrap items-center gap-6">
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all" className="flex items-center gap-2"><Users className="h-4 w-4" /> All Customers ({customers.length})</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="selective" id="selective" /><Label htmlFor="selective">Selective Customers</Label></div>
                                     <div className="flex items-center space-x-2"><RadioGroupItem value="external" id="external" /><Label htmlFor="external">External List</Label></div>
                                </RadioGroup>

                                {targetAudience === 'selective' && (
                                    <div className="mt-4 pl-6 space-y-4">
                                         <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Search customers..."
                                                value={customerSearchQuery}
                                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                                className="pl-8"
                                            />
                                         </div>
                                         {loadingCustomers ? <Skeleton className="h-48 w-full" /> : (
                                            <ScrollArea className="h-48 w-full rounded-md border p-4">
                                                <div className="flex items-center space-x-2 mb-4 border-b pb-2">
                                                    <Checkbox id="select-all" onCheckedChange={handleSelectAll} checked={filteredSelectiveCustomers.length > 0 && selectedCustomers.length === filteredSelectiveCustomers.length} />
                                                    <Label htmlFor="select-all" className="font-semibold">Select All ({filteredSelectiveCustomers.length})</Label>
                                                </div>
                                                {filteredSelectiveCustomers.map(customer => (
                                                    <div key={customer.id} className="flex items-center space-x-2 mb-2">
                                                        <Checkbox id={customer.id} onCheckedChange={(checked) => {
                                                            setSelectedCustomers(prev => checked ? [...prev, customer.id] : prev.filter(id => id !== customer.id));
                                                        }} checked={selectedCustomers.includes(customer.id)}/>
                                                        <Label htmlFor={customer.id} className="font-normal">{customer.name} ({customer.email})</Label>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                         )}
                                    </div>
                                )}
                                {targetAudience === 'external' && (
                                    <div className="mt-4 pl-6 space-y-2">
                                        <Label htmlFor="external-emails">External Email List</Label>
                                        <Textarea
                                            id="external-emails"
                                            placeholder="Paste emails here, separated by commas, semicolons, or new lines."
                                            value={externalEmails}
                                            onChange={(e) => setExternalEmails(e.target.value)}
                                            rows={5}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        
                         <Card>
                            <CardHeader><CardTitle>Email Content</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="subject" render={({ field }) => (
                                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="Announcing our new summer plan!" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                    <FormItem><FormLabel>Header Image URL (Optional)</FormLabel><FormControl><Input placeholder="https://example.com/image.png" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField
                                    control={form.control}
                                    name="body"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Body</FormLabel>
                                            <FormControl>
                                                <Controller
                                                    control={form.control}
                                                    name="body"
                                                    render={({ field: { onChange, value } }) => (
                                                         <SunEditor
                                                            setContents={value}
                                                            onChange={onChange}
                                                            setOptions={{
                                                                height: '250',
                                                                buttonList: [
                                                                    ['undo', 'redo'],
                                                                    ['font', 'fontSize', 'formatBlock'],
                                                                    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                                                                    ['fontColor', 'hiliteColor'],
                                                                    ['removeFormat'],
                                                                    '/',
                                                                    ['outdent', 'indent'],
                                                                    ['align', 'horizontalRule', 'list', 'table'],
                                                                    ['link', 'image', 'video'],
                                                                    ['fullScreen', 'showBlocks', 'codeView'],
                                                                ],
                                                            }}
                                                        />
                                                    )}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="attachment"
                                    render={({ field: { onChange, value, ...rest }}) => (
                                        <FormItem>
                                            <FormLabel>Attachment (Optional)</FormLabel>
                                            <FormControl>
                                                <Input type="file" onChange={e => onChange(e.target.files?.[0])} {...rest} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="ml-auto" disabled={isSending}>
                            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            Send to {getRecipientList().length} Recipients
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
