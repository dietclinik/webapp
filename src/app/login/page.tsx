
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { useState } from "react";
import { signInWithEmailAndPassword, signInWithCustomToken, User } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Eye, EyeOff, Loader2, MessageSquare, Mail, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
]


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [loginMethod, setLoginMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [countryCode, setCountryCode] = useState("91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(""); // Combined full number
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth, db } = useFirebase();

  const checkSubscription = async (user: User) => {
    if (!db) return { valid: true };

    const customerDocRef = doc(db, "customers", user.uid);
    
    try {
        const customerDocSnap = await getDoc(customerDocRef);
        if (!customerDocSnap.exists()) {
            return { valid: false, reason: "No customer record found for this user." };
        }

        const customerData = customerDocSnap.data();
        
        // Priority 1: Check if the account is explicitly marked as Inactive.
        if (customerData.status === 'Inactive') {
            return { valid: false, reason: "Your Account is Inactive, Contact your Admin.." };
        }

        // If not explicitly Inactive, the user can log in (even if expired, to allow renewal).
        return { valid: true };

    } catch (error) {
        console.error("Error checking subscription:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not verify subscription status." });
        return { valid: false, reason: "Could not verify subscription status." };
    }
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) {
        toast({ variant: 'destructive', title: "Error", description: "Authentication service is not available." });
        return;
    }
    
    setIsLoggingIn(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        const { valid, reason } = await checkSubscription(userCredential.user);
        if (!valid) {
            await auth.signOut();
            toast({
                variant: 'destructive',
                title: "Login Failed",
                description: reason,
                duration: 5000,
            });
        } else {
            router.push('/dashboard/overview');
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber) {
        toast({ variant: 'destructive', title: "Error", description: "Mobile number is required." });
        return;
    }
    
    // Combine country code and mobile number without the plus sign
    const fullNumber = `${countryCode}${mobileNumber.replace(/\D/g, '')}`;
    setPhoneNumber(fullNumber); // Store for verification
    
    setIsSendingOtp(true);
    try {
        const res = await fetch('/api/auth/whatsapp/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: fullNumber })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
        
        setOtpSent(true);
        toast({ title: "OTP Sent", description: "Verification code has been sent to your WhatsApp number." });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
        setIsSendingOtp(false);
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
        toast({ variant: 'destructive', title: "Error", description: "OTP is required." });
        return;
    }
    
    setIsVerifyingOtp(true);
    try {
        const res = await fetch('/api/auth/whatsapp/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, otp })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        
        if (!auth) throw new Error("Authentication service is not available.");
        
        const userCredential = await signInWithCustomToken(auth, data.token);
        const { valid, reason } = await checkSubscription(userCredential.user);
        
        if (!valid) {
            await auth.signOut();
            toast({ variant: 'destructive', title: "Login Failed", description: reason });
        } else {
            router.push('/dashboard/overview');
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Verification Failed", description: error.message });
    } finally {
        setIsVerifyingOtp(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
            <Logo />
            <Card className="w-[400px]">
            <CardHeader className="text-center">
                <CardTitle>Customer Login</CardTitle>
                <CardDescription>
                Enter your credentials to access your dashboard.
                New user? <Link href="/#plans" className="underline text-primary">Choose a plan to register.</Link>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="whatsapp" onValueChange={(val) => setLoginMethod(val as any)}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> WhatsApp
                        </TabsTrigger>
                        <TabsTrigger value="email" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Email
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="whatsapp">
                        {!otpSent ? (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Mobile Number</Label>
                                    <div className="flex gap-2">
                                        <div className="w-[100px]">
                                            <Select value={countryCode} onValueChange={setCountryCode}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Code" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="91">+91 (IN)</SelectItem>
                                                    <SelectItem value="1">+1 (US/CA)</SelectItem>
                                                    <SelectItem value="44">+44 (UK)</SelectItem>
                                                    <SelectItem value="971">+971 (UAE)</SelectItem>
                                                    <SelectItem value="61">+61 (AU)</SelectItem>
                                                    <SelectItem value="65">+65 (SG)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1 relative">
                                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="mobile" 
                                                placeholder="9876543210" 
                                                required 
                                                value={mobileNumber} 
                                                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))} 
                                                className="pl-9" 
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Select your country code and enter your mobile number.</p>
                                </div>
                                <Button type="submit" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" disabled={isSendingOtp}>
                                    {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Verification Code
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="otp">Verification Code</Label>
                                    <Input id="otp" placeholder="Enter 6-digit code" required value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[10px] text-muted-foreground">Code sent to {phoneNumber}</p>
                                        <button type="button" onClick={() => setOtpSent(false)} className="text-[10px] text-primary underline">Change Number</button>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={isVerifyingOtp} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                                    {isVerifyingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Verify & Login
                                </Button>
                            </form>
                        )}
                    </TabsContent>

                    <TabsContent value="email">
                        <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                            <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(prev => !prev)}>
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span className="sr-only">Toggle password visibility</span>
                            </Button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoggingIn} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                            {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Login with Email
                        </Button>
                        </form>
                    </TabsContent>
                </Tabs>
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
