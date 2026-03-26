
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function RenewPage() {
    const router = useRouter();

    useEffect(() => {
        // This page is now a simple redirector to the main plans page.
        // The registration page handles renewals more gracefully.
        router.replace('/#plans');
    }, [router]);

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header variant="dark" />
            <main className="flex-1 flex items-center justify-center">
                 <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <CardTitle className="text-2xl">Looking to Renew?</CardTitle>
                        <CardDescription>
                            Please select a plan from our homepage to start the renewal process. You will be redirected shortly.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/#plans">
                            <Button>
                                Go to Plans <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
