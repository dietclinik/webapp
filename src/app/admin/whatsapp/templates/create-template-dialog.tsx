"use client";

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, HelpCircle, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateTemplateDialogProps {
    onSuccess: () => void;
    initialData?: any;
    trigger?: React.ReactNode;
}

export function CreateTemplateDialog({ onSuccess, initialData, trigger }: CreateTemplateDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();

    const [template, setTemplate] = React.useState({
        name: initialData?.name || '',
        category: initialData?.category || 'MARKETING',
        language: initialData?.language || 'en_US',
        components: initialData?.components || [
            { type: 'BODY', text: '', example: undefined }
        ]
    });

    // Reset template if initialData changes or dialog opens
    React.useEffect(() => {
        if (open) {
            setTemplate({
                name: initialData?.name || '',
                category: initialData?.category || 'MARKETING',
                language: initialData?.language || 'en_US',
                components: initialData?.components || [
                    { type: 'BODY', text: '', example: undefined }
                ]
            });
        }
    }, [open, initialData]);

    const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
    const languages = [
        { label: 'English (US)', value: 'en_US' },
        { label: 'English (UK)', value: 'en_GB' },
        { label: 'Hindi', value: 'hi' },
        { label: 'Tamil', value: 'ta' }
    ];

    const handleAddComponent = (type: string) => {
        if (template.components.some((c: any) => c.type === type)) {
            toast({ variant: 'destructive', title: 'Error', description: `${type} component already exists.` });
            return;
        }

        const newComponent: any = { type };
        if (type === 'HEADER') {
            newComponent.format = 'TEXT';
            newComponent.text = '';
        } else if (type === 'FOOTER') {
            newComponent.text = '';
        } else if (type === 'BUTTONS') {
            newComponent.buttons = [];
        }

        setTemplate(prev => ({
            ...prev,
            components: [...prev.components, newComponent].sort((a: any, b: any) => {
                const order = { HEADER: 0, BODY: 1, FOOTER: 2, BUTTONS: 3 };
                return (order[a.type as keyof typeof order] || 0) - (order[b.type as keyof typeof order] || 0);
            })
        }));
    };

    const removeComponent = (type: string) => {
        if (type === 'BODY') return; // Body is required
        setTemplate(prev => ({
            ...prev,
            components: prev.components.filter((c: any) => c.type !== type)
        }));
    };

    const updateComponent = (type: string, data: any) => {
        setTemplate(prev => ({
            ...prev,
            components: prev.components.map((c: any) => c.type === type ? { ...c, ...data } : c)
        }));
    };

    const extractVariables = (text: string) => {
        const matches = text.match(/{{(\d+)}}/g);
        if (!matches) return [];
        return Array.from(new Set(matches.map(m => m.replace(/{{|}}/g, '')))).sort((a, b) => Number(a) - Number(b));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/admin/whatsapp/templates/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (type === 'HEADER') {
                updateComponent('HEADER', { example: { header_handle: [data.handle] } });
            }
            
            toast({ title: 'Upload Success', description: 'Template sample uploaded' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        const isEdit = !!initialData;
        if (!template.name || !template.components.find((c: any) => c.type === 'BODY')?.text) {
            toast({ variant: 'destructive', title: 'Error', description: 'Template name and body are required.' });
            return;
        }

        // Validate variables and samples
        if (template.category === 'AUTHENTICATION') {
            const body = template.components.find((c: any) => c.type === 'BODY');
            const buttons = template.components.find((c: any) => c.type === 'BUTTONS');
            
            if (template.components.length > 2) {
                toast({ variant: 'destructive', title: 'Error', description: 'Authentication templates can only have Body and Buttons.' });
                return;
            }
            if (!body?.text.includes('{{1}}')) {
                toast({ variant: 'destructive', title: 'Error', description: 'Authentication templates must include {{1}} for the code.' });
                return;
            }
            if (!buttons || buttons.buttons.length !== 1 || buttons.buttons[0].type !== 'COPY_CODE') {
                toast({ variant: 'destructive', title: 'Error', description: 'Authentication templates must have exactly one "Copy Code" button.' });
                return;
            }
        }

        for (const comp of template.components) {
            if (comp.type === 'BODY' || (comp.type === 'HEADER' && comp.format === 'TEXT')) {
                const vars = extractVariables(comp.text || '');
                const samples = comp.type === 'BODY' ? comp.example?.body_text?.[0] : comp.example?.header_text;
                
                if (vars.length > 0 && (!samples || samples.length < vars.length)) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'Missing Samples', 
                        description: `Please provide samples for all variables in the ${comp.type}.` 
                    });
                    return;
                }
            }

            if (comp.type === 'BUTTONS') {
                for (const btn of comp.buttons) {
                    if (!btn.text) {
                        toast({ variant: 'destructive', title: 'Error', description: 'All buttons must have a label.' });
                        return;
                    }
                    if (btn.type === 'URL' && !btn.url) {
                        toast({ variant: 'destructive', title: 'Error', description: 'URL is required for URL buttons.' });
                        return;
                    }
                    if (btn.type === 'PHONE_NUMBER' && !btn.phone_number) {
                        toast({ variant: 'destructive', title: 'Error', description: 'Phone number is required for phone buttons.' });
                        return;
                    }
                }
            }
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/whatsapp/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: isEdit ? 'resubmit' : 'create',
                    template: {
                        ...template,
                        name: template.name.toLowerCase().replace(/\s+/g, '_'),
                        // Keep mapping settings if editing
                        actionType: initialData?.actionType || '',
                        isEnabled: initialData?.isEnabled || false
                    }
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: 'Success', description: isEdit ? 'Template resubmitted for approval.' : 'Template submitted for approval.' });
            setOpen(false);
            onSuccess();
        } catch (error: any) {
            toast({ 
                variant: 'destructive', 
                title: isEdit ? 'Resubmission Failed' : 'Submission Failed', 
                description: error.message 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="default">
                        <Plus className="mr-2 h-4 w-4" /> Create Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create WhatsApp Template</DialogTitle>
                    <DialogDescription>
                        Design your message template and submit it to Meta for approval.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Template Name</Label>
                            <Input 
                                id="name" 
                                placeholder="e.g. welcome_message" 
                                value={template.name}
                                disabled={!!initialData}
                                onChange={e => setTemplate({ ...template, name: e.target.value })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                {initialData ? "Template name cannot be changed." : "Lowercase, numbers and underscores only."}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select 
                                value={template.category} 
                                onValueChange={val => setTemplate({ ...template, category: val as any })}
                            >
                                <SelectTrigger id="category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Components</h3>
                            <div className="flex gap-2">
                                {!template.components.some(c => c.type === 'HEADER') && (
                                    <Button variant="outline" size="sm" onClick={() => handleAddComponent('HEADER')}>
                                        Add Header
                                    </Button>
                                )}
                                {!template.components.some(c => c.type === 'FOOTER') && (
                                    <Button variant="outline" size="sm" onClick={() => handleAddComponent('FOOTER')}>
                                        Add Footer
                                    </Button>
                                )}
                                {!template.components.some(c => c.type === 'BUTTONS') && (
                                    <Button variant="outline" size="sm" onClick={() => handleAddComponent('BUTTONS')}>
                                        Add Buttons
                                    </Button>
                                )}
                            </div>
                        </div>

                        {template.components.map((comp: any, idx: number) => (
                            <Card key={idx} className="relative">
                                <CardContent className="pt-6">
                                    {comp.type !== 'BODY' && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-2 right-2 text-destructive"
                                            onClick={() => removeComponent(comp.type)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Badge className="mb-4">{comp.type}</Badge>

                                    {comp.type === 'HEADER' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Header Format</Label>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant={comp.format === 'TEXT' ? 'default' : 'outline'} 
                                                        size="sm"
                                                        onClick={() => updateComponent('HEADER', { format: 'TEXT', text: '', example: undefined })}
                                                    >
                                                        Text
                                                    </Button>
                                                    <Button 
                                                        variant={comp.format === 'IMAGE' ? 'default' : 'outline'} 
                                                        size="sm"
                                                        onClick={() => updateComponent('HEADER', { format: 'IMAGE', example: { header_handle: [] } })}
                                                    >
                                                        <ImageIcon className="mr-2 h-4 w-4" /> Image
                                                    </Button>
                                                </div>
                                            </div>

                                            {comp.format === 'TEXT' ? (
                                                <div className="space-y-2">
                                                    <Label>Header Text</Label>
                                                    <Input 
                                                        placeholder="e.g. Welcome {{1}}" 
                                                        value={comp.text}
                                                        onChange={e => {
                                                            const text = e.target.value;
                                                            const vars = extractVariables(text);
                                                            updateComponent('HEADER', { 
                                                                text, 
                                                                example: vars.length > 0 ? { header_text: Array(vars.length).fill('') } : undefined 
                                                            });
                                                        }}
                                                    />
                                                    {extractVariables(comp.text).length > 0 && (
                                                        <div className="space-y-2 mt-2 border p-3 rounded-md bg-slate-50 dark:bg-slate-900">
                                                            <Label className="text-xs">Variable Samples (Header)</Label>
                                                            {extractVariables(comp.text).map((v: string, i: number) => (
                                                                <Input 
                                                                    key={i}
                                                                    placeholder={`Sample for {{${v}}}`}
                                                                    className="h-8 text-xs"
                                                                    value={comp.example.header_text[i] || ''}
                                                                    onChange={e => {
                                                                        const samples = [...comp.example.header_text];
                                                                        samples[i] = e.target.value;
                                                                        updateComponent('HEADER', { example: { header_text: samples } });
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                                    <p className="text-sm text-muted-foreground">
                                                        {comp.example?.header_handle?.length > 0 
                                                            ? `Sample uploaded: ${comp.example.header_handle[0].substring(0, 10)}...` 
                                                            : 'Select an image sample to upload.'}
                                                    </p>
                                                    <Input 
                                                        type="file" 
                                                        className="hidden" 
                                                        id="header-image" 
                                                        accept="image/*" 
                                                        onChange={e => handleFileUpload(e, 'HEADER')}
                                                    />
                                                    <Label htmlFor="header-image" className="mt-2 block cursor-pointer text-primary underline">
                                                        {comp.example?.header_handle?.length > 0 ? 'Change image' : 'Click to upload sample image'}
                                                    </Label>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {comp.type === 'BODY' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Body Text</Label>
                                                <Textarea 
                                                    placeholder="Enter your message here... Use {{1}}, {{2}} for variables." 
                                                    className="min-h-[120px]"
                                                    value={comp.text}
                                                    onChange={e => {
                                                        const text = e.target.value;
                                                        const vars = extractVariables(text);
                                                        updateComponent('BODY', { 
                                                            text, 
                                                            example: vars.length > 0 ? { body_text: [Array(vars.length).fill('')] } : undefined 
                                                        });
                                                    }}
                                                />
                                                {extractVariables(comp.text).length > 0 && (
                                                    <div className="space-y-2 mt-2 border p-3 rounded-md bg-slate-50 dark:bg-slate-900">
                                                        <Label className="text-xs">Variable Samples (Body)</Label>
                                                        {extractVariables(comp.text).map((v: string, i: number) => (
                                                            <Input 
                                                                key={i}
                                                                placeholder={`Sample for {{${v}}}`}
                                                                className="h-8 text-xs"
                                                                value={comp.example.body_text[0][i] || ''}
                                                                onChange={e => {
                                                                    const samples = [...comp.example.body_text[0]];
                                                                    samples[i] = e.target.value;
                                                                    updateComponent('BODY', { example: { body_text: [samples] } });
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {comp.type === 'FOOTER' && (
                                        <div className="space-y-2">
                                            <Label>Footer Text</Label>
                                            <Input 
                                                placeholder="e.g. Reply STOP to opt out" 
                                                value={comp.text}
                                                onChange={e => updateComponent('FOOTER', { text: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {comp.type === 'BUTTONS' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label>Buttons</Label>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        disabled={comp.buttons.length >= 3}
                                                        onClick={() => {
                                                            const buttons = [...comp.buttons, { type: 'QUICK_REPLY', text: '' }];
                                                            updateComponent('BUTTONS', { buttons });
                                                        }}
                                                    >
                                                        Add Quick Reply
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        disabled={comp.buttons.length >= 3}
                                                        onClick={() => {
                                                            const buttons = [...comp.buttons, { type: 'PHONE_NUMBER', text: '', phone_number: '' }];
                                                            updateComponent('BUTTONS', { buttons });
                                                        }}
                                                    >
                                                        Add Phone Number
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        disabled={comp.buttons.length >= 3}
                                                        onClick={() => {
                                                            const buttons = [...comp.buttons, { type: 'URL', text: '', url: '' }];
                                                            updateComponent('BUTTONS', { buttons });
                                                        }}
                                                    >
                                                        Add URL
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        disabled={comp.buttons.length >= 3}
                                                        onClick={() => {
                                                            const buttons = [...comp.buttons, { type: 'COPY_CODE', text: 'Copy Code' }];
                                                            updateComponent('BUTTONS', { buttons });
                                                        }}
                                                    >
                                                        Add Copy Code
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {comp.buttons.map((btn: any, bIdx: number) => (
                                                    <div key={bIdx} className="space-y-2 border p-3 rounded-md relative">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-6 w-6 text-destructive"
                                                            onClick={() => {
                                                                const buttons = comp.buttons.filter((_: any, i: number) => i !== bIdx);
                                                                updateComponent('BUTTONS', { buttons });
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px]">Button Label</Label>
                                                                <Input 
                                                                    placeholder="Button Text" 
                                                                    value={btn.text}
                                                                    onChange={e => {
                                                                        const buttons = [...comp.buttons];
                                                                        buttons[bIdx].text = e.target.value;
                                                                        updateComponent('BUTTONS', { buttons });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px]">Type: {btn.type}</Label>
                                                                {btn.type === 'PHONE_NUMBER' && (
                                                                    <Input 
                                                                        placeholder="Phone (e.g. +1...)" 
                                                                        value={btn.phone_number}
                                                                        onChange={e => {
                                                                            const buttons = [...comp.buttons];
                                                                            buttons[bIdx].phone_number = e.target.value;
                                                                            updateComponent('BUTTONS', { buttons });
                                                                        }}
                                                                    />
                                                                )}
                                                                {btn.type === 'URL' && (
                                                                    <Input 
                                                                        placeholder="URL (e.g. https://...)" 
                                                                        value={btn.url}
                                                                        onChange={e => {
                                                                            const buttons = [...comp.buttons];
                                                                            buttons[bIdx].url = e.target.value;
                                                                            updateComponent('BUTTONS', { buttons });
                                                                        }}
                                                                    />
                                                                )}
                                                                {btn.type === 'COPY_CODE' && (
                                                                    <div className="h-10 bg-muted/50 rounded flex items-center px-2 text-[10px] text-muted-foreground">
                                                                        Required for Authentication
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
