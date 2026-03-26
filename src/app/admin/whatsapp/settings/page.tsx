"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WhatsAppSettingsPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [settings, setSettings] = React.useState({
        accessToken: '',
        phoneNumberId: '',
        businessAccountId: '',
        webhookVerifyToken: '',
        appId: '',
        isEnabled: false,
        isConfigured: false,
        phoneNumberVerified: false
    });
    const [templates, setTemplates] = React.useState<any[]>([]);
    const [testPhone, setTestPhone] = React.useState('');
    const [selectedTemplate, setSelectedTemplate] = React.useState('');
    const [sendingTest, setSendingTest] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        fetchSettings();
        fetchTemplates();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/whatsapp/settings');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to fetch settings'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/whatsapp/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({
                title: 'Success',
                description: 'Settings saved successfully'
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to save settings'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const res = await fetch('/api/admin/whatsapp/test-connection', {
                method: 'POST'
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({
                title: 'Success',
                description: 'WhatsApp API connection successful!'
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Connection Failed',
                description: error.message || 'Failed to connect to WhatsApp API'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleToggle = async (checked: boolean) => {
        try {
            const res = await fetch('/api/admin/whatsapp/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: checked })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSettings(prev => ({ ...prev, isEnabled: checked }));
            toast({
                title: checked ? 'WhatsApp Enabled' : 'WhatsApp Disabled',
                description: `WhatsApp messaging has been ${checked ? 'enabled' : 'disabled'}.`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to update status'
            });
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/admin/whatsapp/templates');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTemplates(data.templates || []);
        } catch (error: any) {
            console.error('Failed to fetch templates:', error);
        }
    };

    const handleSendTest = async () => {
        if (!testPhone || !selectedTemplate) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a template and enter a phone number.'
            });
            return;
        }

        setSendingTest(true);
        try {
            const template = templates.find(t => t.name === selectedTemplate);
            
            // Dynamically determine parameters based on template body
            const bodyComponent = template?.components?.find((c: any) => c.type === 'BODY');
            const bodyText = bodyComponent?.text || '';
            const variableMatches = bodyText.match(/{{(\d+)}}/g) || [];
            
            const components = [];
            if (variableMatches.length > 0) {
                components.push({
                    type: 'body',
                    parameters: Array(variableMatches.length).fill({ type: 'text', text: 'Test User' })
                });
            }

            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testPhone,
                    toName: 'Test User',
                    templateName: selectedTemplate,
                    language: template?.language || 'en',
                    components
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({
                title: 'Success',
                description: 'Test message sent successfully!'
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Send Failed',
                description: error.message || 'Failed to send test message'
            });
        } finally {
            setSendingTest(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">WhatsApp Settings</h1>
                <p className="text-muted-foreground">Configure your Meta WhatsApp Business API connection.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>API Configuration</CardTitle>
                        <CardDescription>Enter your Meta WhatsApp Cloud API credentials.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="accessToken">Access Token</Label>
                                <Input
                                    id="accessToken"
                                    type="password"
                                    value={settings.accessToken}
                                    onChange={e => setSettings({ ...settings, accessToken: e.target.value })}
                                    placeholder="EAAB..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                                <Input
                                    id="phoneNumberId"
                                    value={settings.phoneNumberId}
                                    onChange={e => setSettings({ ...settings, phoneNumberId: e.target.value })}
                                    placeholder="123456789..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
                                <Input
                                    id="businessAccountId"
                                    value={settings.businessAccountId}
                                    onChange={e => setSettings({ ...settings, businessAccountId: e.target.value })}
                                    placeholder="123456789..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="verifyToken">Webhook Verify Token</Label>
                                <Input
                                    id="verifyToken"
                                    value={settings.webhookVerifyToken}
                                    onChange={e => setSettings({ ...settings, webhookVerifyToken: e.target.value })}
                                    placeholder="my_custom_token"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appId">WhatsApp App ID</Label>
                                <Input
                                    id="appId"
                                    value={settings.appId}
                                    onChange={e => setSettings({ ...settings, appId: e.target.value })}
                                    placeholder="123456789..."
                                />
                                <p className="text-[10px] text-muted-foreground">Required for template media sample uploads.</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Settings
                                </Button>
                                <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testing || !settings.isConfigured}>
                                    {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {!testing && <Send className="mr-2 h-4 w-4" />}
                                    Test Connection
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Status & Controls</CardTitle>
                            <CardDescription>Manage your WhatsApp service status.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Enable WhatsApp Messaging</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Activate automated messaging for customers and staff.
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.isEnabled}
                                    onCheckedChange={handleToggle}
                                    disabled={!settings.isConfigured}
                                />
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="flex items-center gap-2">
                                    {settings.isConfigured ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-destructive" />
                                    )}
                                    <span className="font-medium">API Configured</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {settings.phoneNumberVerified ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-warning" />
                                    )}
                                    <span className="font-medium">Phone Number Verified</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Implementation Checklist</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Create Meta Business Account
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Verify your Phone Number in Meta Events Manager
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Set Webhook URL to: <code>{(process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''))}/api/whatsapp/webhook</code>
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Configure Message Templates in Meta Dashboard
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Send Test Message</CardTitle>
                    <CardDescription>Verify your configuration by sending a test message using a template.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="testTemplate">Template</Label>
                            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                <SelectTrigger id="testTemplate">
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.filter(t => t.status === 'APPROVED').map(template => (
                                        <SelectItem key={template.id} value={template.name}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                    {templates.filter(t => t.status === 'APPROVED').length === 0 && (
                                        <SelectItem value="none" disabled>No approved templates found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="testPhone">Recipient Phone Number</Label>
                            <Input
                                id="testPhone"
                                placeholder="91XXXXXXXXXX"
                                value={testPhone}
                                onChange={e => setTestPhone(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Include country code without + (e.g., 91 for India)</p>
                        </div>
                        <div className="flex gap-4">
                            <Button
                                onClick={handleSendTest}
                                disabled={sendingTest || !settings.isEnabled || !selectedTemplate || !testPhone}
                                className="w-full"
                            >
                                {sendingTest ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Send Test Message
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
