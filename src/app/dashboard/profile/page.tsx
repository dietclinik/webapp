
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState, useMemo, useCallback } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updatePassword, User as FirebaseUser } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, Eye, EyeOff, Flame, Wheat, Drumstick, Leaf, Ruler } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { calculateMacros, MacrosOutput } from "@/ai/flows/calculate-macros-flow";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { CarouselApi } from "@/components/ui/carousel";

type ProfileData = {
  name: string;
  email: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  healthProblems: string;
  allergies: string;
  photoURL?: string;
  activityLevel?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  leftImageUrl?: string;
  rightImageUrl?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  fibre?: string;
};

type BmiResult = {
  value: string;
  message: string;
  colorClass: string;
  suggestion?: string;
};

type BmrResult = {
    value: string;
    message: string;
}

const initialProfile: ProfileData = {
    name: "",
    email: "",
    age: "",
    gender: "other",
    height: "",
    weight: "",
    healthProblems: "",
    allergies: "",
    photoURL: "",
    activityLevel: "",
}

const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters."),
  newPassword: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters."),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});

const profileFormSchema = z.object({
  activityLevel: z.string().optional(),
});

type ImageSliderDialogProps = {
    images: string[];
    startIndex: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

function ImageSliderDialog({ images, startIndex, open, onOpenChange }: ImageSliderDialogProps) {
    const [api, setApi] = useState<CarouselApi>();

    useEffect(() => {
        if (api && open) {
            api.scrollTo(startIndex, true);
        }
    }, [api, startIndex, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0">
                 <DialogHeader className="sr-only">
                    <DialogTitle>Body Images</DialogTitle>
                </DialogHeader>
                <Carousel setApi={setApi} className="w-full">
                    <CarouselContent>
                        {images.map((src, index) => (
                            <CarouselItem key={index}>
                                <div className="p-1">
                                     <div className="relative aspect-square w-full">
                                        <Image src={src} alt={`Body image ${index + 1}`} fill objectFit="contain" />
                                    </div>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </DialogContent>
        </Dialog>
    );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [bmrResult, setBmrResult] = useState<BmrResult | null>(null);
  const [macroResult, setMacroResult] = useState<MacrosOutput | null>(null);
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);
  const [isImageSliderOpen, setIsImageSliderOpen] = useState(false);
  const [sliderStartIndex, setSliderStartIndex] = useState(0);

  const { toast } = useToast();
  const { auth, db, storage } = useFirebase();
  const router = useRouter();

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
        activityLevel: '',
    }
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  const hasUnsavedChanges = form.formState.isDirty || imageFile !== null;

  const openImageSlider = (startIndex: number) => {
    setSliderStartIndex(startIndex);
    setIsImageSliderOpen(true);
  };
  
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
        return false;
    }
    
    setIsSubmitting(true);
    let photoURL = profile.photoURL;

    try {
        if(imageFile && storage) {
            const storageRef = ref(storage, `profile_pictures/${userId}/${imageFile.name}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            photoURL = await getDownloadURL(uploadResult.ref);
        }

        const profileDataToSave = {
            ...profile,
            activityLevel: form.getValues().activityLevel || profile.activityLevel,
            photoURL,
            protein: macroResult?.protein.toString() || profile.protein,
            carbs: macroResult?.carbs.toString() || profile.carbs,
            fat: macroResult?.fat.toString() || profile.fat,
            fibre: macroResult?.fibre.toString(),
        };
        
        const profileDocRef = doc(db, "userProfiles", userId);
        const customerDocRef = doc(db, "customers", userId);
        await setDoc(profileDocRef, profileDataToSave, { merge: true });
        await updateDoc(customerDocRef, { "activityLevel": profileDataToSave.activityLevel });

        setProfile(profileDataToSave);
        form.reset({ activityLevel: profileDataToSave.activityLevel });
        setImageFile(null);
        toast({ variant: "success", title: "Success", description: "Profile saved successfully!" });
        return true;
    } catch (error) {
        console.error("Error saving profile: ", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not save profile." });
        return false;
    } finally {
        setIsSubmitting(false);
    }
  }

  const { bmiResult } = useMemo(() => {
    if (!profile.height || !profile.weight) {
        return { bmiResult: null };
    }
    const heightInMeters = Number(profile.height) / 100;
    const weightInKg = Number(profile.weight);

    let bmiRes: BmiResult | null = null;

    if (heightInMeters > 0 && weightInKg > 0) {
      const bmi = weightInKg / (heightInMeters * heightInMeters);
      let message = "", colorClass = "", suggestion = "";

      const targetWeight = 22 * (heightInMeters * heightInMeters);
      const weightDiff = weightInKg - targetWeight;

      if (bmi < 18.5) { 
          message = "Underweight"; 
          colorClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"; 
          suggestion = `You have to Gain ${Math.abs(weightDiff).toFixed(1)} kg to be Fit`;
      }
      else if (bmi < 25) { 
          message = "Normal Weight"; 
          colorClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"; 
          suggestion = "You are in a healthy weight range. Keep it up!";
      }
      else if (bmi < 30) { 
          message = "Overweight"; 
          colorClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200"; 
          suggestion = `You have to Lose ${weightDiff.toFixed(1)} kg to be Fit`;
      }
      else { 
          message = "Obesity"; 
          colorClass = "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200"; 
          suggestion = `You have to Lose ${weightDiff.toFixed(1)} kg to be Fit`;
      }
      bmiRes = { value: bmi.toFixed(2), message, colorClass, suggestion };
    }

    return { bmiResult: bmiRes };
  }, [profile]);
  
  useEffect(() => {
    const calculateBmr = () => {
        const heightInMeters = Number(profile.height) / 100;
        const weightInKg = Number(profile.weight);
        const ageInYears = Number(profile.age);
        const gender = profile.gender;
        let bmr = 0;
        if (weightInKg > 0 && heightInMeters > 0 && ageInYears > 0 && gender) {
            if(gender === 'male'){
                bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) + 5;
            } else {
                bmr = (10 * weightInKg) + (6.25 * (heightInMeters * 100)) - (5 * ageInYears) - 161;
            }
            setBmrResult({ value: bmr.toFixed(0), message: "calories/day" });
        } else {
            setBmrResult(null);
        }
    }
    calculateBmr();
  }, [profile]);
  
  const watchedActivityLevel = form.watch("activityLevel");
  
  const calculateAndSetMacros = useCallback(async () => {
    if (!bmrResult?.value || !watchedActivityLevel || !profile.weight || !profile.height || !profile.age) return;

    const calorieNeeds = Number(watchedActivityLevel);
    if(calorieNeeds > 0){
        setIsCalculatingMacros(true);
        try {
            const result = await calculateMacros({
                bmr: calorieNeeds,
                weight: Number(profile.weight),
                height: Number(profile.height),
                age: Number(profile.age),
            });
            setMacroResult(result);
        } catch(e) {
             console.error("Macro calculation failed:", e);
             setMacroResult(null);
        } finally {
            setIsCalculatingMacros(false);
        }
    } else {
        setMacroResult(null);
    }
  }, [bmrResult, watchedActivityLevel, profile.weight, profile.height, profile.age]);

  useEffect(() => {
    if (watchedActivityLevel) {
        calculateAndSetMacros();
    }
  }, [watchedActivityLevel, calculateAndSetMacros]);

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const profileDocRef = doc(db, "userProfiles", user.uid);
        try {
            const profileSnap = await getDoc(profileDocRef);
            
            let profileData = initialProfile;
            if (profileSnap.exists()) {
                profileData = { ...profileData, ...profileSnap.data() };
            }
            
            profileData.email = user.email || "";
            setProfile(profileData);
            form.reset({ activityLevel: profileData.activityLevel || '' });
            setMacroResult({
                protein: Number(profileData.protein) || 0,
                carbs: Number(profileData.carbs) || 0,
                fat: Number(profileData.fat) || 0,
                fibre: Number(profileData.fibre) || 0,
            });

            if (profileData.photoURL) {
                setImagePreview(profileData.photoURL);
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
  }, [toast, auth, db, form]);

 useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = ''; // Required for some browsers
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}, [hasUnsavedChanges]);


  const handleChangePassword = async (data: z.infer<typeof passwordFormSchema>) => {
    setIsChangingPassword(true);
    const user = auth?.currentUser;

    if (!user || !user.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
      setIsChangingPassword(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      
      toast({ variant: 'success', title: 'Success', description: 'Password updated successfully.' });
      passwordForm.reset();
    } catch (error: any) {
      console.error("Password change error:", error);
       if (error.code === 'auth/wrong-password') {
            toast({ variant: 'destructive', title: 'Error', description: 'Incorrect current password.' });
       } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to change password. Please try again.' });
       }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const activityLevels = [
      { id: "sedentary", label: "Little or No Exercise", multiplier: 1.2 },
      { id: "light", label: "Light Exercise/Sports (1-3 Days/week)", multiplier: 1.375 },
      { id: "moderate", label: "Moderate Exercise/Sports (3-5 Days/week)", multiplier: 1.55 },
      { id: "hard", label: "Hard Exercise/Sports (6-7 Days/week)", multiplier: 1.725 },
      { id: "very-hard", label: "Very Hard Exercise/Sports & Physical Job", multiplier: 1.9 },
  ];
  
  const bodyImages = [
      profile?.frontImageUrl,
      profile?.backImageUrl,
      profile?.leftImageUrl,
      profile?.rightImageUrl
  ].filter(Boolean) as string[];

  const activityLevelIsSet = !!profile.activityLevel;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Update your personal information and account security.</p>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList>
            <TabsTrigger value="personal">Personal Information</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="personal" className="mt-6">
              <FormProvider {...form}>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                      <Card>
                          <CardHeader>
                          <CardTitle>Personal Details</CardTitle>
                          <CardDescription>You can update your photo. Contact admin to change other details.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                              <div className="flex flex-col items-center gap-4">
                                  <Avatar className="h-24 w-24">
                                      <AvatarImage src={imagePreview || undefined} alt="Profile Preview" />
                                      <AvatarFallback>{profile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="space-y-2 text-center">
                                      <Label htmlFor="photo" className="cursor-pointer text-primary hover:underline">
                                          {isSubmitting ? "Uploading..." : "Change Photo"}
                                      </Label>
                                      <Input id="photo" type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isSubmitting} />
                                      <p className="text-xs text-muted-foreground">JPG, PNG, or GIF. 5MB max.</p>
                                  </div>
                              </div>

                              <div className="grid gap-6 md:grid-cols-2">
                                  <div className="space-y-2">
                                      <Label htmlFor="name">Full Name</Label>
                                      <Input id="name" value={profile.name} disabled />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="email">Email</Label>
                                      <Input id="email" type="email" value={profile.email} disabled />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="age">Age</Label>
                                      <Input id="age" type="number" value={profile.age} disabled />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="gender">Gender</Label>
                                      <Select value={profile.gender} disabled>
                                          <SelectTrigger>
                                          <SelectValue placeholder="Select gender" />
                                          </SelectTrigger>
                                          <SelectContent>
                                          <SelectItem value="female">Female</SelectItem>
                                          <SelectItem value="male">Male</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                          </SelectContent>
                                      </Select>
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="height">Height (cm)</Label>
                                      <Input id="height" type="number" value={profile.height} disabled />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="weight">Weight (kg)</Label>
                                      <Input id="weight" type="number" value={profile.weight} disabled />
                                  </div>
                              </div>
                              
                              <div className="grid md:grid-cols-2 gap-6">
                                  {bmiResult && (
                                      <Card className={cn("transition-all", bmiResult.colorClass)}>
                                          <CardHeader>
                                              <CardTitle>BMI Result</CardTitle>
                                              <CardDescription>Body Mass Index</CardDescription>
                                          </CardHeader>
                                          <CardContent className="text-center">
                                              <p className="text-5xl font-bold">{bmiResult.value}</p>
                                              <p className="text-lg font-semibold mt-2">{bmiResult.message}</p>
                                              {bmiResult.suggestion && <p className="text-base font-bold mt-2">{bmiResult.suggestion}</p>}
                                          </CardContent>
                                      </Card>
                                  )}
                                  {form.getValues('activityLevel') && (
                                      <Card>
                                          <CardHeader>
                                              <CardTitle>Daily Calorie Goal</CardTitle>
                                              <CardDescription>Based on your selected activity level.</CardDescription>
                                          </CardHeader>
                                          <CardContent className="text-center">
                                              <p className="text-5xl font-bold">{parseFloat(form.getValues('activityLevel')!).toFixed(0)}</p>
                                              <p className="text-lg font-semibold mt-2 text-muted-foreground">calories/day</p>
                                          </CardContent>
                                      </Card>
                                  )}
                              </div>

                              {bmrResult && (
                                  <Card className="bg-primary/5 border-primary">
                                      <CardHeader>
                                          <CardTitle>Update Your Activity Level</CardTitle>
                                          <CardDescription>To get personalized macronutrient recommendations, please select your daily activity level.</CardDescription>
                                      </CardHeader>
                                      <CardContent>
                                          <FormField
                                              control={form.control}
                                              name="activityLevel"
                                              render={({ field }) => (
                                                  <FormItem className="space-y-3 pt-4">
                                                      <FormControl>
                                                          <RadioGroup
                                                              onValueChange={field.onChange}
                                                              value={field.value}
                                                              className="flex flex-col space-y-1"
                                                              disabled={activityLevelIsSet}
                                                          >
                                                              {activityLevels.map(level => (
                                                                  <FormItem key={level.id} className="flex items-center space-x-3 space-y-0">
                                                                      <FormControl>
                                                                          <RadioGroupItem value={String(parseFloat(bmrResult.value) * level.multiplier)} />
                                                                      </FormControl>
                                                                      <FormLabel className={cn("font-normal", activityLevelIsSet && "cursor-not-allowed opacity-70")}>
                                                                          {level.label}: <span className="font-semibold text-primary">{(parseFloat(bmrResult.value) * level.multiplier).toFixed(0)} kcal</span>
                                                                      </FormLabel>
                                                                  </FormItem>
                                                              ))}
                                                          </RadioGroup>
                                                      </FormControl>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                      </CardContent>
                                  </Card>
                              )}

                              {macroResult && (
                                  <Card className="bg-amber-50 dark:bg-amber-900/20 relative">
                                      <CardHeader><CardTitle>Daily Macronutrient Needs</CardTitle></CardHeader>
                                      <CardContent className="space-y-3">
                                      {isCalculatingMacros ? <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <>
                                              <p className="flex items-center gap-2"><Drumstick className="h-5 w-5 text-amber-600"/> Protein: <span className="font-bold ml-auto">{macroResult.protein.toFixed(0)}g</span></p>
                                              <p className="flex items-center gap-2"><Wheat className="h-5 w-5 text-amber-600"/> Carbohydrates: <span className="font-bold ml-auto">{macroResult.carbs.toFixed(0)}g</span></p>
                                              <p className="flex items-center gap-2"><Flame className="h-5 w-5 text-amber-600"/> Fat: <span className="font-bold ml-auto">{macroResult.fat.toFixed(0)}g</span></p>
                                              <p className="flex items-center gap-2"><Leaf className="h-5 w-5 text-amber-600"/> Fibre: <span className="font-bold ml-auto">{macroResult.fibre.toFixed(0)}g</span></p>
                                          </>}
                                      </CardContent>
                                  </Card>
                              )}

                              <div className="space-y-2">
                              <Label htmlFor="health-problems">Health Problems</Label>
                              <Textarea id="health-problems" placeholder="e.g., High blood pressure, PCOS" value={profile.healthProblems} disabled />
                              </div>
                              <div className="space-y-2">
                              <Label htmlFor="allergies">Allergies</Label>
                              <Textarea id="allergies" placeholder="e.g., Peanuts, Gluten" value={profile.allergies} disabled />
                              </div>

                              <Card>
                                  <CardHeader>
                                      <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5"/> Body Images</CardTitle>
                                      <CardDescription>Images you uploaded during registration.</CardDescription>
                                  </CardHeader>
                                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                      {bodyImages.map((img, index) => (
                                          <button key={index} type="button" onClick={() => openImageSlider(index)} className="border rounded-md overflow-hidden focus:ring-2 ring-primary">
                                              <Image src={img} alt={`Body image ${index+1}`} width={200} height={300} className="w-full object-cover aspect-[2/3]"/>
                                          </button>
                                      ))}
                                      {bodyImages.length === 0 && <div className="col-span-4 text-muted-foreground text-center p-8 border rounded-md">No body images uploaded.</div>}
                                  </CardContent>
                              </Card>

                              <div className="flex justify-end">
                                {hasUnsavedChanges && (
                                    <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                )}
                              </div>
                          </CardContent>
                      </Card>
                  </form>
              </FormProvider>
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
                                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowCurrentPassword(prev => !prev)}>
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
                                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowNewPassword(prev => !prev)}>
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
                                                  <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(prev => !prev)}>
                                                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                  </Button>
                                              </div>
                                          </FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}
                              />
                              <Button type="submit" disabled={isChangingPassword} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
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
      <ImageSliderDialog images={bodyImages} startIndex={sliderStartIndex} open={isImageSliderOpen} onOpenChange={setIsImageSliderOpen} />
    </>
  );
}
