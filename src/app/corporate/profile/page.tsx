"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { Loader2 } from "lucide-react";

type CorporateProfile = {
  name: string;
  email: string;
  mobile: string;
  address: string;
};

const initialProfile: CorporateProfile = {
    name: "",
    email: "",
    mobile: "",
    address: "",
}

export default function CorporateProfilePage() {
  const [profile, setProfile] = useState<CorporateProfile>(initialProfile);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { auth, db } = useFirebase();

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const profileDocRef = doc(db, "corporates", user.uid);
        try {
            const docSnap = await getDoc(profileDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({ ...initialProfile, ...data, email: user.email || "" });
            } else {
                setProfile(prev => ({...prev, email: user.email || ""}));
            }
        } catch (error) {
            console.error("Error fetching profile: ", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch profile." });
        }
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, [toast, auth, db]);


  const handleSaveChanges = async () => {
    if (!userId || !db) {
        toast({ variant: 'destructive', title: "Error", description: "You are not logged in or database is unavailable." });
        return;
    }
    
    setIsSubmitting(true);

    try {
        const profileDataToSave = {
            name: profile.name,
            mobile: profile.mobile,
            address: profile.address,
        };
        
        const profileDocRef = doc(db, "corporates", userId);
        await updateDoc(profileDocRef, profileDataToSave);

        toast({ variant: "success", title: "Success", description: "Profile saved successfully!" });
    } catch (error) {
        console.error("Error saving profile: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not save profile." });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Update your company and contact information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" value={profile.name} onChange={(e) => setProfile(p => ({...p, name: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={profile.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input id="mobile" value={profile.mobile} onChange={(e) => setProfile(p => ({...p, mobile: e.target.value}))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={profile.address} onChange={(e) => setProfile(p => ({...p, address: e.target.value}))} />
            </div>
            
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
