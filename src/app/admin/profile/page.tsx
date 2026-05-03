"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Eye, EyeOff, MessageSquare, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type AdminProfile = {
    name: string;
    email: string;
    mobile: string;
    designation: string;
    photoURL?: string;
};

const initialProfile: AdminProfile = {
    name: "",
    email: "",
    mobile: "",
    designation: "",
    photoURL: "",
};

const passwordFormSchema = z.object({
    currentPassword: z.string().min(6, "Password must be at least 6 characters."),
    newPassword: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters."),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
});

export default function AdminProfilePage() {
    const [profile, setProfile] = useState<AdminProfile>(initialProfile);
    const [userId, setUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { toast } = useToast();
    const { auth, db, storage } = useFirebase();

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    useEffect(() => {
        if (!auth || !db) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            setUserId(user.uid);
            try {
                const docSnap = await getDoc(doc(db, "admins", user.uid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setProfile({ ...initialProfile, ...data, email: user.email || "" });
                    if (data.photoURL) setImagePreview(data.photoURL);
                } else {
                    setProfile(prev => ({ ...prev, email: user.email || "" }));
                }
            } catch (error) {
                console.error("Error fetching admin profile:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not fetch profile." });
            }
        });
        return () => unsubscribe();
    }, [auth, db, toast]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !db) {
            toast({ variant: "destructive", title: "Error", description: "Not logged in or database unavailable." });
            return;
        }

        if (profile.mobile && !/^\d{10,15}$/.test(profile.mobile.replace(/\D/g, ''))) {
            toast({ variant: "destructive", title: "Invalid Mobile", description: "Enter a valid mobile number (10-15 digits)." });
            return;
        }

        setIsSaving(true);
        let photoURL = profile.photoURL;

        try {
            if (imageFile && storage) {
                const storageRef = ref(storage, `admin_pictures/${userId}/${imageFile.name}`);
                const uploadResult = await uploadBytes(storageRef, imageFile);
                photoURL = await getDownloadURL(uploadResult.ref);
            }

            const dataToSave = {
                name: profile.name,
                mobile: profile.mobile.replace(/\D/g, ''),
                designation: profile.designation,
                photoURL,
            };

            await updateDoc(doc(db, "admins", userId), dataToSave);
            setProfile(prev => ({ ...prev, ...dataToSave }));
            toast({ variant: "success", title: "Success", description: "Profile saved successfully!" });
        } catch (error) {
            console.error("Error saving admin profile:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save profile." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (data: z.infer<typeof passwordFormSchema>) => {
        setIsChangingPassword(true);
        const user = auth?.currentUser;
        if (!user?.email) {
            toast({ variant: "destructive", title: "Error", description: "User not found." });
            setIsChangingPassword(false);
            return;
        }
        try {
            const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, data.newPassword);
            toast({ variant: "success", title: "Success", description: "Password updated successfully." });
            passwordForm.reset();
        } catch (error: any) {
            if (error.code === "auth/wrong-password") {
                toast({ variant: "destructive", title: "Error", description: "Incorrect current password." });
            } else {
                toast({ variant: "destructive", title: "Error", description: "Failed to change password. Please try again." });
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold">My Profile</h1>
                <p className="text-muted-foreground">Manage your admin account information and security settings.</p>
            </div>

            <Tabs defaultValue="personal" className="w-full">
                <TabsList>
                    <TabsTrigger value="personal">Personal Information</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Information</CardTitle>
                            <CardDescription>Update your name, mobile number, and profile photo.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveChanges} className="grid gap-6 md:grid-cols-2">
                                {/* Avatar */}
                                <div className="md:col-span-2 flex flex-col items-center gap-4">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={imagePreview || undefined} alt="Profile" />
                                        <AvatarFallback>{profile.name?.charAt(0).toUpperCase() || "A"}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1 text-center">
                                        <Label htmlFor="photo" className="cursor-pointer text-primary hover:underline">
                                            {isSaving ? "Uploading..." : "Change Photo"}
                                        </Label>
                                        <Input id="photo" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isSaving} />
                                        <p className="text-xs text-muted-foreground">JPG, PNG, or GIF. 5MB max.</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="Admin Name"
                                        value={profile.name}
                                        onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={profile.email} disabled />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="designation">Designation</Label>
                                    <Input
                                        id="designation"
                                        placeholder="e.g. Super Admin"
                                        value={profile.designation}
                                        onChange={(e) => setProfile(p => ({ ...p, designation: e.target.value }))}
                                    />
                                </div>

                                {/* Mobile — highlighted as important for WhatsApp OTP */}
                                <div className="space-y-2">
                                    <Label htmlFor="mobile" className="flex items-center gap-2">
                                        Mobile Number
                                        <Badge variant="outline" className="text-[#25D366] border-[#25D366] gap-1 font-normal">
                                            <MessageSquare className="h-3 w-3" /> WhatsApp OTP
                                        </Badge>
                                    </Label>
                                    <Input
                                        id="mobile"
                                        placeholder="e.g. 919876543210"
                                        value={profile.mobile}
                                        onChange={(e) => setProfile(p => ({ ...p, mobile: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-[#25D366]" />
                                        This number is used for WhatsApp OTP login. Include country code (e.g. 91xxxxxxxxxx).
                                    </p>
                                </div>

                                <div className="md:col-span-2 flex justify-end">
                                    <Button type="submit" disabled={isSaving} style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Enter your current password to set a new one.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4 max-w-sm">
                                    <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Current Password</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type={showCurrentPassword ? "text" : "password"} {...field} />
                                                        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowCurrentPassword(p => !p)}>
                                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New Password</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type={showNewPassword ? "text" : "password"} {...field} />
                                                        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowNewPassword(p => !p)}>
                                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm New Password</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type={showConfirmPassword ? "text" : "password"} {...field} />
                                                        <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(p => !p)}>
                                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" disabled={isChangingPassword} style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}>
                                        {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Change Password
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
