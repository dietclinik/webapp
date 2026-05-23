"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Download } from 'lucide-react';
import { MobileSearch } from "@/components/ui/mobile-search";

export default function WhatsAppLogsPage() {
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState("");

    React.useEffect(() => {
        setTimeout(() => setLoading(false), 800);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Message Logs</h1>
                    <p className="text-muted-foreground">History of all automated messages sent via WhatsApp.</p>
                </div>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <MobileSearch value={search} onChange={setSearch} placeholder="Search logs by phone or name..." />
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-xl font-medium">No logs available</h3>
                            <p className="text-muted-foreground">Start sending messages to see them logged here.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
