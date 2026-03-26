"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Eye, MessageSquare, Plus, Edit, Trash2 } from 'lucide-react';
import { CreateTemplateDialog } from './create-template-dialog';

export default function WhatsAppTemplatesPage() {
    const [loading, setLoading] = React.useState(true);
    const [syncing, setSyncing] = React.useState(false);
    const [templates, setTemplates] = React.useState<any[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/admin/whatsapp/templates');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTemplates(data.templates || []);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to fetch templates'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/whatsapp/templates', { method: 'POST' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({
                title: 'Sync Complete',
                description: `Successfully synced ${data.count} templates from Meta.`
            });
            fetchTemplates();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: error.message || 'Failed to sync templates'
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete template "${name}"? This will also remove it from Meta.`)) return;

        try {
            const res = await fetch(`/api/admin/whatsapp/templates?id=${id}&name=${name}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: 'Deleted',
                description: 'Template deleted successfully.'
            });
            fetchTemplates();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Delete Failed',
                description: error.message || 'Failed to delete template'
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-500';
            case 'PENDING': return 'bg-yellow-500';
            case 'REJECTED': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
                    <p className="text-muted-foreground">Manage and sync your WhatsApp message templates.</p>
                </div>
                <div className="flex gap-2">
                    <CreateTemplateDialog onSuccess={fetchTemplates} />
                    <Button onClick={handleSync} disabled={syncing} variant="outline">
                        {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync from Meta
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Available Templates</CardTitle>
                    <CardDescription>Templates fetched from Meta WhatsApp Business Account.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No templates found</h3>
                            <p className="text-muted-foreground mb-6">Sync templates from your Meta account to get started.</p>
                            <Button onClick={handleSync} variant="outline">Sync Now</Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Template Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{template.category}</Badge>
                                        </TableCell>
                                        <TableCell>{template.language}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${getStatusColor(template.status)}`} />
                                                {template.status}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <CreateTemplateDialog 
                                                    onSuccess={fetchTemplates} 
                                                    initialData={template}
                                                    trigger={
                                                        <Button variant="ghost" size="icon">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    }
                                                />
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-destructive"
                                                    onClick={() => handleDelete(template.id, template.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
