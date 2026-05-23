"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, MessageCircle } from 'lucide-react';

export default function WhatsAppInboxPage() {
    const [loading, setLoading] = React.useState(true);
    const [messages, setMessages] = React.useState<any[]>([]);

    React.useEffect(() => {
        // Mocking for now, will connect to API
        setTimeout(() => {
            setMessages([]);
            setLoading(false);
        }, 1000);
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
                <p className="text-muted-foreground">View and respond to incoming WhatsApp messages.</p>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search messages or contacts..." className="pl-8" />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20">
                            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-xl font-medium">Your inbox is empty</h3>
                            <p className="text-muted-foreground">When customers message you, they'll appear here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Inbox items will go here */}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
