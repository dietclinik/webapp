
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowRight, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function MarketingPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    Marketing Tools
                </h1>
                <p className="text-muted-foreground">Engage with your customers through email and WhatsApp.</p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="h-5 w-5 text-primary" />
                                    Bulk Email
                                </CardTitle>
                                <CardDescription>Send promotional or informational emails to your customers.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/admin/marketing/bulk-email" className="w-full">
                            <div className="flex items-center justify-end text-sm font-medium text-primary hover:underline w-full">
                                Send Emails <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </Link>
                    </CardFooter>
                </Card>

                 <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    Bulk WhatsApp
                                </CardTitle>
                                <CardDescription>Send templated messages to customers via WhatsApp.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/admin/marketing/bulk-whatsapp" className="w-full">
                            <div className="flex items-center justify-end text-sm font-medium text-primary hover:underline w-full">
                               Send Messages <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
