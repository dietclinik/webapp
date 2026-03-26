
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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

type VendorProfile = {
  name: string;
  email: string;
  mobile: string;
  address: string;
  photoURL?: string;
};

const initialProfile: VendorProfile = {
    name: "",
    email: "",
    mobile: "",
    address: "",
    photoURL: "",
}

export default function VendorProfilePage() {
  const [profile, setProfile] = useState<VendorProfile>(initialProfile);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { auth, db, storage } = useFirebase();

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const profileDocRef = doc(db, "vendors", user.uid);
        try {
            const docSnap = await getDoc(profileDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({ ...initialProfile, ...data, email: user.email || "" });
                if (data.photoURL) {
                    setImagePreview(data.photoURL);
                }
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }
  }

  const handleSaveChanges = async () => {
    if (!userId || !db) {
        toast({ variant: 'destructive', title: "Error", description: "You are not logged in or database is unavailable." });
        return;
    }
    
    setIsUploading(true);
    let photoURL = profile.photoURL;

    try {
        if(imageFile && storage) {
            const storageRef = ref(storage, `vendor_pictures/${userId}/${imageFile.name}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            photoURL = await getDownloadURL(uploadResult.ref);
        }

        const profileDataToSave = {
            name: profile.name,
            mobile: profile.mobile,
            address: profile.address,
            photoURL,
        };
        
        const profileDocRef = doc(db, "vendors", userId);
        await updateDoc(profileDocRef, profileDataToSave);

        setProfile(prev => ({...prev, ...profileDataToSave}));
        toast({ variant: "success", title: "Success", description: "Profile saved successfully!" });
    } catch (error) {
        console.error("Error saving profile: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not save profile." });
    } finally {
        setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Update your business and contact information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
             <div className="md:col-span-2 flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={imagePreview || undefined} alt="Profile Preview" />
                    <AvatarFallback>{profile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-y-2 text-center">
                    <Label htmlFor="photo" className="cursor-pointer text-primary hover:underline">
                        {isUploading ? "Uploading..." : "Change Photo"}
                    </Label>
                    <Input id="photo" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isUploading} />
                    <p className="text-xs text-muted-foreground">JPG, PNG, or GIF. 5MB max.</p>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
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
              <Button type="submit" disabled={isUploading} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
