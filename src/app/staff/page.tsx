
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
]


export default function StaffLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth, db } = useFirebase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) {
        toast({ variant: 'destructive', title: "Error", description: "Authentication service is not available." });
        return;
    }
    
    setIsLoggingIn(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        const staffDocRef = doc(db, 'staff', userCredential.user.uid);
        const staffDocSnap = await getDoc(staffDocRef);
        if (staffDocSnap.exists()) {
            router.push('/staff/dashboard');
        } else {
            await auth.signOut();
            toast({
                variant: "destructive",
                title: "Access Denied",
                description: "You are not an authorized staff member.",
            });
        }
    } catch(error: any) {
        const errorCode = error.code;
        let errorMessage = error.message;

        if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
          errorMessage = "Invalid email or password. Please try again.";
        }
        toast({ variant: 'destructive', title: "Login Failed", description: errorMessage });
    } finally {
        setIsLoggingIn(false);
    }
  }

  return (
     <div className="flex flex-col min-h-screen bg-background">
       <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
            <Logo />
            <Card className="w-[400px]">
            <CardHeader className="text-center">
                <CardTitle>Staff Login</CardTitle>
                <CardDescription>
                Access the staff portal.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                    <Label htmlFor="staff-email">Email</Label>
                    <Input id="staff-email" type="email" placeholder="staff@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="staff-password">Password</Label>
                    <div className="relative">
                    <Input id="staff-password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(prev => !prev)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">Toggle password visibility</span>
                    </Button>
                    </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoggingIn}>
                        {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Login
                    </Button>
                </form>
            </CardContent>
            </Card>
        </div>
       </main>
        <div className="border-t">
            <div className="container mx-auto py-4 px-4 md:px-6">
                <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                    {policyLinks.map(link => (
                        <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
        <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Diet Clinik. All rights reserved.</p>
            <nav className="sm:ml-auto flex gap-4 sm:gap-6">
            <p className="text-sm text-muted-foreground">App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Catchy Technologies</a></p>
            </nav>
        </footer>
    </div>
  );
}
