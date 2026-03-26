"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Users, PlusCircle, PlayCircle } from 'lucide-react';

export default function WhatsAppCampaignPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bulk Campaign</h1>
                    <p className="text-muted-foreground">Send mass messages to your customers and partners.</p>
                </div>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Campaign
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Create Campaign</CardTitle>
                        <CardDescription>Define your target audience and message template.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input placeholder="e.g., Summer Promotion 2026" />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Select Audience</Label>
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose recipients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all_customers">All Customers</SelectItem>
                                        <SelectItem value="active_customers">Active Customers</SelectItem>
                                        <SelectItem value="all_partners">All Partners</SelectItem>
                                        <SelectItem value="staff">All Staff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Template</Label>
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="promo_1">Promotion A</SelectItem>
                                        <SelectItem value="promo_2">Promotion B</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button className="w-full mt-4">
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Start Campaign
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Campaigns</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-10">
                            <Megaphone className="mx-auto h-10 w-10 text-muted-foreground opacity-20 mb-2" />
                            <p className="text-sm text-muted-foreground text-center">No campaign history found.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
