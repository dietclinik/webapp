
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Send, Loader2, Users, User, Venus, Mars } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirebase } from '@/components/firebase-provider';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import 'suneditor/dist/css/suneditor.min.css';
import { sendWhatsAppMessage } from "@/ai/flows/send-whatsapp-message-flow";


type Customer = {
    id: string;
    name: string;
    mobile: string;
    gender: 'male' | 'female' | 'other';
}

export default function BulkWhatsappPage() {
    const [isSending, setIsSending] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [targetAudience, setTargetAudience] = useState<'all' | 'gender' | 'selective'>('all');
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'other' | 'all'>('all');
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [variables, setVariables] = useState('');

    const { toast } = useToast();
    const { db } = useFirebase();

     useEffect(() => {
        if (!db) return;
        const fetchCustomers = async () => {
            setLoadingCustomers(true);
            try {
                const customersQuery = query(collection(db, 'customers'), where('status', '==', 'Active'));
                const snapshot = await getDocs(customersQuery);
                 const profileDocs = await Promise.all(
                    snapshot.docs.map(customerDoc => getDoc(doc(db, 'userProfiles', customerDoc.id)))
                );
                const profileMap = new Map(profileDocs.map(doc => [doc.id, doc.data()?.gender || 'other']));
                const customerList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    mobile: doc.data().mobile,
                    gender: profileMap.get(doc.id) || 'other',
                })).filter(c => c.mobile) as Customer[];
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
        switch (targetAudience) {
            case 'all': return customers;
            case 'gender': return customers.filter(c => c.gender === selectedGender);
            case 'selective': return customers.filter(c => selectedCustomers.includes(c.id));
            default: return [];
        }
    }

    const handleSend = async () => {
        setIsSending(true);
        const recipients = getRecipientList();

        if (recipients.length === 0 || !templateName) {
            toast({ variant: 'destructive', title: "Missing Information", description: "Please select recipients and enter a template name." });
            setIsSending(false);
            return;
        }
        
        let parsedVars: string[] = [];
        try {
            if (variables) {
                const parsed = JSON.parse(variables);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    parsedVars = parsed;
                } else {
                    throw new Error("Input must be an array of strings, like [\"value1\", \"value2\"].");
                }
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Invalid Variables JSON", description: e.message || "Please check the format of your variables." });
            setIsSending(false);
            return;
        }
        
        let successCount = 0;
        const promises = recipients.map(async (recipient) => {
            try {
                // Dynamically replace placeholder with customer name if it exists.
                const finalVars = parsedVars.map(v => v.replace('{customer_name}', recipient.name.split(' ')[0]));
                
                const result = await sendWhatsAppMessage({
                    templateName: templateName,
                    recipient: recipient.mobile,
                    variables: finalVars
                });

                if (result.success) {
                    successCount++;
                }
            } catch (e) {
                console.error(`Failed to send to ${recipient.mobile}`, e);
            }
        });
        
        await Promise.all(promises);

        toast({
            title: "Campaign Finished",
            description: `Sent messages to ${successCount} out of ${recipients.length} recipients.`,
            variant: "success",
        });
        setIsSending(false);
    };
    
    const handleSelectAll = (checked: boolean) => {
        setSelectedCustomers(checked ? customers.map(c => c.id) : []);
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
                        <CardTitle>Send Bulk WhatsApp</CardTitle>
                        <CardDescription>Send a templated WhatsApp message to a targeted group of customers.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Target Audience</CardTitle></CardHeader>
                    <CardContent>
                        <RadioGroup value={targetAudience} onValueChange={(v) => setTargetAudience(v as any)} className="flex items-center gap-6">
                             <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all" className="flex items-center gap-2"><Users className="h-4 w-4" /> All Customers ({customers.length})</Label></div>
                             <div className="flex items-center space-x-2"><RadioGroupItem value="gender" id="gender" /><Label htmlFor="gender">By Gender</Label></div>
                             <div className="flex items-center space-x-2"><RadioGroupItem value="selective" id="selective" /><Label htmlFor="selective">Selective Customers</Label></div>
                        </RadioGroup>
                         {targetAudience === 'gender' && (
                             <div className="mt-4 pl-6 flex items-center gap-4">
                                <RadioGroup value={selectedGender} onValueChange={(v) => setSelectedGender(v as any)} className="flex items-center gap-6">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="male" id="male" /><Label htmlFor="male"><Mars className="inline mr-1 h-4 w-4" /> Male</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="female" id="female" /><Label htmlFor="female"><Venus className="inline mr-1 h-4 w-4"/> Female</Label></div>
                                </RadioGroup>
                             </div>
                        )}
                        {targetAudience === 'selective' && (
                            <div className="mt-4 pl-6">
                                {loadingCustomers ? <Skeleton className="h-48 w-full" /> : (
                                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                                        <div className="flex items-center space-x-2 mb-4 border-b pb-2">
                                            <Checkbox id="select-all" onCheckedChange={handleSelectAll} checked={selectedCustomers.length === customers.length && customers.length > 0} />
                                            <Label htmlFor="select-all" className="font-semibold">Select All</Label>
                                        </div>
                                        {customers.map(customer => (
                                            <div key={customer.id} className="flex items-center space-x-2 mb-2">
                                                <Checkbox id={customer.id} onCheckedChange={(checked) => setSelectedCustomers(prev => checked ? [...prev, customer.id] : prev.filter(id => id !== customer.id))} checked={selectedCustomers.includes(customer.id)}/>
                                                <Label htmlFor={customer.id} className="font-normal">{customer.name} ({customer.mobile})</Label>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <div className="space-y-2">
                    <Label htmlFor="template-name">MSG91 Template Name</Label>
                    <Input id="template-name" placeholder="e.g., welcome_message" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="variables">Template Variables (JSON Array)</Label>
                    <Textarea id="variables" placeholder='e.g., ["value1", "value2", "{customer_name}"]' value={variables} onChange={(e) => setVariables(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Enter an array of strings. Use {'{customer_name}'} to automatically insert the customer's first name.</p>
                </div>
            </CardContent>
             <CardFooter>
                <Button className="ml-auto" onClick={handleSend} disabled={isSending}>
                     {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send to {getRecipientList().length} Customers
                </Button>
            </CardFooter>
        </Card>
    );
}
