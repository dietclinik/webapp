
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { createNotification } from "@/ai/flows/create-notification-flow";
import { cn } from "@/lib/utils";
import { format, isToday, isPast, startOfDay, isBefore } from "date-fns";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, Timestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { BrainCircuit, CheckCircle, Clock, Utensils, Save, Loader2, Camera, MessageSquare, Check, X, Ban, UserCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type FoodItem = {
    foodName: string;
    quantity: string;
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fibre?: number;
};

type Meal = {
    time: string;
    title: string;
    foodItems: FoodItem[];
    suggestions?: string;
};

type DietPlan = {
    id: string;
    name: string;
    target?: string;
    focus?: string;
    meals: Meal[];
    createdBy?: string;
};

type DailyLogData = {
    selections: { [mealTime: string]: number[] }; // Array of selected food item indices
    notes: { [mealTime: string]: string };
    imageURLs: { [mealTime: string]: string };
    skipped: { [mealTime: string]: { reason: string } };
    isDaySkipped?: { reason: string };
};

type CustomerData = {
    id: string;
    name: string;
    email: string;
    mobile: string;
    planId: string;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
    vendorId?: string;
    address: string;
    bloodGroup: string;
    status: string;
    since: string;
    isNew: boolean;
    paymentStatus: string;
    customFields: Record<string, any>;
    dietPlanId: string | null;
    assignedStaffId?: string;
};

const formatTime12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 'N/A';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

const compressImage = (file: File, maxSizeKB: number = 500): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                let quality = 0.9;
                const process = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob && (blob.size / 1024 < maxSizeKB || quality <= 0.5)) {
                                resolve(blob);
                            } else if (quality > 0.5) {
                                quality -= 0.1;
                                process();
                            } else {
                                reject(new Error("Could not compress image to target size."));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                process();
            };
        };
        reader.onerror = error => reject(error);
    });
};


export default function DieticianDietPlanPage() {
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
    const [planCreator, setPlanCreator] = useState<string | null>(null);
    const [allLogs, setAllLogs] = useState<{ [key: string]: DailyLogData }>({});
    const [userId, setUserId] = useState<string | null>(null);
    const [customerName, setCustomerName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<{ [key: string]: string }>({});
    const [imageFiles, setImageFiles] = useState<{ [key: string]: File | null }>({});
    const [imagePreviews, setImagePreviews] = useState<{ [key: string]: string | null }>({});
    const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [hasLoggedOnce, setHasLoggedOnce] = useState(false);
    const [skipDialogOpen, setSkipDialogOpen] = useState(false);
    const [skipTarget, setSkipTarget] = useState<{ type: 'meal' | 'day'; time?: string; title?: string } | null>(null);
    const [skipReason, setSkipReason] = useState('');

    const [customer, setCustomer] = useState<CustomerData | null>(null);

    const { toast } = useToast();
    const { auth, db } = useFirebase();

    const selectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
    const dailyLog = useMemo(() => allLogs[selectedDateKey] || { selections: {}, notes: {}, imageURLs: {}, skipped: {} }, [allLogs, selectedDateKey]);

    useEffect(() => {
        setNotes(dailyLog.notes || {});
        setImagePreviews(dailyLog.imageURLs || {});
        setImageFiles({});
    }, [dailyLog]);

    useEffect(() => {
        if (!auth || !db) return;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            setUserId(user.uid);
            setLoading(true);

            try {
                const customerDocRef = doc(db, 'customers', user.uid);
                const customerDoc = await getDoc(customerDocRef);

                if (customerDoc.exists()) {
                    const fetchedCustomer = { id: customerDoc.id, ...customerDoc.data() } as CustomerData;
                    setCustomer(fetchedCustomer);
                    setCustomerName(fetchedCustomer.name || "Customer");

                    if (fetchedCustomer.dietPlanId) {
                        const planDocRef = doc(db, 'dietPlans', fetchedCustomer.dietPlanId);
                        const planDoc = await getDoc(planDocRef);
                        if (planDoc.exists()) {
                            const planData = { id: planDoc.id, ...planDoc.data() } as any;

                            // Handle both old and new structure
                            let meals = planData.meals || [];
                            if (meals.length > 0 && meals[0].options) {
                                // Old structure: convert to new
                                meals = meals.map((meal: any) => ({
                                    time: meal.time,
                                    title: meal.title,
                                    suggestions: meal.suggestions,
                                    foodItems: meal.options?.[0]?.foodItems || []
                                }));
                            }

                            setDietPlan({
                                id: planData.id,
                                name: planData.name,
                                target: planData.target,
                                focus: planData.focus,
                                meals: meals,
                                createdBy: planData.createdBy
                            });

                            if (planData.createdBy) {
                                // Fetch creator name
                                const staffDoc = await getDoc(doc(db, 'staff', planData.createdBy));
                                if (staffDoc.exists()) {
                                    setPlanCreator(staffDoc.data().name);
                                } else {
                                    const adminDoc = await getDoc(doc(db, 'admins', planData.createdBy));
                                    if (adminDoc.exists()) setPlanCreator("Admin");
                                }
                            }
                        }
                    }
                }

                const logsCollectionRef = collection(db, 'users', user.uid, 'dieticianPlanLogs');
                const unsubscribeLog = onSnapshot(logsCollectionRef, (snapshot) => {
                    setHasLoggedOnce(!snapshot.empty);
                    const logsData: { [key: string]: DailyLogData } = {};
                    snapshot.forEach(doc => {
                        logsData[doc.id] = doc.data() as DailyLogData;
                    });
                    setAllLogs(logsData);
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching logs:", error);
                    toast({ variant: 'destructive', title: "Error", description: "Failed to load logs." });
                    setLoading(false);
                });

                return () => unsubscribeLog();
            } catch (error) {
                console.error("Error fetching initial data:", error);
                toast({ variant: 'destructive', title: "Error", description: "Failed to load your data." });
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, [auth, db, toast]);


    const handleFoodItemToggle = async (mealTime: string, foodIndex: number) => {
        if (!userId || !db) return;

        const currentLog = allLogs[selectedDateKey] || { selections: {}, notes: {}, imageURLs: {}, skipped: {} };
        const currentSelections = { ...(currentLog.selections || {}) };
        const mealSelections = currentSelections[mealTime] || [];

        const isSelected = mealSelections.includes(foodIndex);
        let newMealSelections: number[];

        if (isSelected) {
            newMealSelections = mealSelections.filter(idx => idx !== foodIndex);
        } else {
            newMealSelections = [...mealSelections, foodIndex];
        }

        if (newMealSelections.length === 0) {
            delete currentSelections[mealTime];
        } else {
            currentSelections[mealTime] = newMealSelections;
        }

        const logDocRef = doc(db, 'users', userId, 'dieticianPlanLogs', selectedDateKey);

        const dataToUpdate = {
            ...currentLog,
            selections: currentSelections,
            dayName: format(selectedDate, 'eeee'),
            createdAt: serverTimestamp(),
        };

        try {
            await setDoc(logDocRef, dataToUpdate, { merge: true });
        } catch (error) {
            console.error("Error updating selection:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save your selection." });
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, mealTime: string) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFiles(prev => ({ ...prev, [mealTime]: file }));
            setImagePreviews(prev => ({ ...prev, [mealTime]: URL.createObjectURL(file) }));
        }
    };

    const handleSaveLog = async (mealTime: string, mealTitle: string) => {
        if (!userId || !db) return;

        const selectedItems = dailyLog?.selections?.[mealTime];
        if (!selectedItems || selectedItems.length === 0) {
            toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please select at least one food item before saving.' });
            return;
        }

        setUploading(prev => ({ ...prev, [mealTime]: true }));

        const logDocRef = doc(db, 'users', userId, 'dieticianPlanLogs', selectedDateKey);
        let imageURL = dailyLog?.imageURLs?.[mealTime] || "";

        try {
            const imageFile = imageFiles[mealTime];
            if (imageFile) {
                const storage = getStorage();
                const compressedBlob = await compressImage(imageFile);
                const imageRef = ref(storage, `user_logs/${userId}/${selectedDateKey}/${mealTime}-${Date.now()}.jpg`);
                await uploadBytes(imageRef, compressedBlob);
                imageURL = await getDownloadURL(imageRef);
            }

            const dataToUpdate = {
                [`notes.${mealTime}`]: notes[mealTime] || "",
                [`imageURLs.${mealTime}`]: imageURL,
                selections: dailyLog?.selections,
                dayName: format(selectedDate, 'eeee'),
                createdAt: serverTimestamp(),
            };

            await setDoc(logDocRef, dataToUpdate, { merge: true });

            const notificationPromises = [];
            notificationPromises.push(createNotification({
                userId: 'admin',
                message: `${customerName} logged their ${mealTitle}.`,
                link: `/admin/customers/view/${userId}`
            }));

            if (customer?.assignedStaffId) {
                notificationPromises.push(createNotification({
                    userId: customer.assignedStaffId,
                    message: `${customerName} logged their ${mealTitle}.`,
                    link: `/staff/my-customers/view/${userId}`
                }));
            }

            await Promise.all(notificationPromises);

            toast({ variant: 'success', title: 'Log Saved!', description: `Your log for ${mealTitle} has been saved.` });

        } catch (error) {
            console.error("Error saving log:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to save your log." });
        } finally {
            setUploading(prev => ({ ...prev, [mealTime]: false }));
        }
    };

    const handleConfirmSkip = async () => {
        if (!skipTarget || !skipReason || !userId || !db) return;

        const logDocRef = doc(db, 'users', userId, 'dieticianPlanLogs', selectedDateKey);
        let dataToUpdate: any = {
            dayName: format(selectedDate, 'eeee'),
            createdAt: serverTimestamp(),
        };
        let notificationMessage = '';

        if (skipTarget.type === 'day') {
            dataToUpdate.isDaySkipped = { reason: skipReason };
            notificationMessage = `${customerName} skipped their diet for the day. Reason: ${skipReason}`;
        } else if (skipTarget.type === 'meal' && skipTarget.time) {
            dataToUpdate[`skipped.${skipTarget.time}`] = { reason: skipReason };
            notificationMessage = `${customerName} skipped ${skipTarget.title}. Reason: ${skipReason}`;
        }

        try {
            await setDoc(logDocRef, dataToUpdate, { merge: true });

            const notificationPromises = [];
            notificationPromises.push(createNotification({
                userId: 'admin',
                message: notificationMessage,
                link: `/admin/customers/view/${userId}`
            }));
            if (customer?.assignedStaffId) {
                notificationPromises.push(createNotification({
                    userId: customer.assignedStaffId,
                    message: notificationMessage,
                    link: `/staff/my-customers/view/${userId}`
                }));
            }
            await Promise.all(notificationPromises);

            toast({ variant: 'success', title: 'Log Updated', description: `Your skip reason has been saved.` });
            setSkipDialogOpen(false);
            setSkipReason('');
            setSkipTarget(null);
        } catch (error) {
            console.error("Error saving skip reason:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to save skip reason." });
        }
    };

    const mealTotals = useMemo(() => {
        const totals: { [mealTime: string]: { calories: number; protein: number; fat: number; carbs: number; fibre: number } } = {};

        if (!dietPlan || !dailyLog || dailyLog.isDaySkipped) return totals;

        dietPlan.meals.forEach(meal => {
            if (dailyLog.skipped?.[meal.time]) return;

            const selectedIndices = dailyLog.selections?.[meal.time] || [];
            let calories = 0, protein = 0, fat = 0, carbs = 0, fibre = 0;

            selectedIndices.forEach(idx => {
                const item = meal.foodItems[idx];
                if (item) {
                    calories += item.calories || 0;
                    protein += item.protein || 0;
                    fat += item.fat || 0;
                    carbs += item.carbs || 0;
                    fibre += item.fibre || 0;
                }
            });

            totals[meal.time] = { calories, protein, fat, carbs, fibre };
        });

        return totals;
    }, [dietPlan, dailyLog]);

    const dailyTotals = useMemo(() => {
        let calories = 0, protein = 0, fat = 0, carbs = 0, fibre = 0;

        Object.values(mealTotals).forEach(total => {
            calories += total.calories;
            protein += total.protein;
            fat += total.fat;
            carbs += total.carbs;
            fibre += total.fibre;
        });

        return {
            calories: calories.toFixed(0),
            protein: protein.toFixed(1),
            fat: fat.toFixed(1),
            carbs: carbs.toFixed(1),
            fibre: fibre.toFixed(1)
        };
    }, [mealTotals]);

    const canEditSelectedDate = useMemo(() => {
        if (!hasLoggedOnce) return true;
        return isToday(selectedDate);
    }, [hasLoggedOnce, selectedDate]);

    if (loading) {
        return <div className="text-center p-8"><p>Loading your diet plan...</p></div>
    }

    if (!dietPlan) {
        return (
            <Card className="text-center p-8">
                <CardTitle>No Diet Plan Assigned</CardTitle>
                <CardDescription className="mt-2">Your diet plan has not been assigned yet. Please contact your consultant.</CardDescription>
            </Card>
        );
    }

    const isDaySkipped = !!dailyLog?.isDaySkipped;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-primary" />
                    Dietician's Plan
                </h1>
                <p className="text-muted-foreground">Focus: {dietPlan.target || dietPlan.focus}</p>
                {planCreator && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <UserCircle className="h-4 w-4" />
                        Created by: {planCreator}
                    </p>
                )}
            </div>

            <Card>
                <CardContent className="p-2 md:p-4">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        disabled={(date) => isBefore(date, startOfDay(new Date(0))) && hasLoggedOnce && !isToday(date) && !Object.keys(allLogs).some(logKey => logKey === format(date, 'yyyy-MM-dd'))}
                        className="rounded-md"
                        components={{
                            DayContent: ({ date }) => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const logForDay = allLogs[dateKey];
                                const isLogged = logForDay && (Object.keys(logForDay.selections).length > 0 || logForDay.isDaySkipped || Object.keys(logForDay.skipped).length > 0);
                                const isMissed = isPast(date) && !isToday(date) && !isLogged;

                                return (
                                    <div className={cn(
                                        "relative w-full h-full flex items-center justify-center",
                                        isLogged && "bg-green-100 dark:bg-green-900/50 rounded-md",
                                        isMissed && "bg-red-100 dark:bg-red-900/50 rounded-md"
                                    )}>
                                        <span>{format(date, 'd')}</span>
                                        {isLogged && <Check className="absolute bottom-1 right-1 h-3 w-3 text-green-600" />}
                                        {isMissed && <X className="absolute bottom-1 right-1 h-3 w-3 text-red-600" />}
                                    </div>
                                );
                            }
                        }}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Log for: {format(selectedDate, 'PPP')}</h2>
                {canEditSelectedDate && !isDaySkipped && (
                    <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" onClick={() => setSkipTarget({ type: 'day' })}>
                                Skip This Day
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Skip Day</DialogTitle>
                                <DialogDescription>
                                    Please provide a reason for skipping. This helps your consultant understand your progress better.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Textarea
                                    placeholder="e.g., Was traveling, felt unwell, attended a party..."
                                    value={skipReason}
                                    onChange={(e) => setSkipReason(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="secondary" onClick={() => setSkipDialogOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleConfirmSkip} disabled={!skipReason.trim()}>
                                    Confirm Skip
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {isDaySkipped ? (
                <Card className="text-center p-8 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <CardTitle className="flex items-center justify-center gap-2"><Ban className="h-6 w-6 text-destructive" /> Day Skipped</CardTitle>
                    <CardDescription className="mt-2 text-destructive">
                        You have marked this day as skipped. Reason: {dailyLog.isDaySkipped?.reason}
                    </CardDescription>
                </Card>
            ) : (
                <>
                    <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
                        {dietPlan.meals.map((meal, index) => {
                            const selectedIndices = dailyLog?.selections?.[meal.time] || [];
                            const isMealSkipped = !!dailyLog?.skipped?.[meal.time];
                            const isLoggedForMeal = selectedIndices.length > 0;
                            const savedNote = dailyLog?.notes?.[meal.time];
                            const savedImageURL = dailyLog?.imageURLs?.[meal.time];
                            const isUploading = uploading[meal.time];
                            const isMealEditable = canEditSelectedDate && !isDaySkipped && !isMealSkipped;
                            const skipReasonText = isMealSkipped ? dailyLog.skipped[meal.time].reason : '';
                            const mealTotal = mealTotals[meal.time] || { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };

                            return (
                                <AccordionItem value={`item-${index}`} key={meal.time}>
                                    <AccordionTrigger className="text-lg font-medium hover:no-underline">
                                        <div className="flex items-center gap-4">
                                            <span className={cn(isLoggedForMeal ? "text-primary" : "", isMealSkipped && "text-destructive line-through")}>{formatTime12Hour(meal.time)} - {meal.title}</span>
                                            {isLoggedForMeal && <CheckCircle className="h-5 w-5 text-primary" />}
                                            {isMealSkipped && <Ban className="h-5 w-5 text-destructive" />}
                                            {!isLoggedForMeal && !isMealSkipped && <Clock className="h-5 w-5 text-muted-foreground" />}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        {isMealSkipped ? (
                                            <div className="p-4 border-l-4 border-destructive bg-destructive/10 rounded-r-md">
                                                <p className="font-semibold text-destructive">You skipped this meal.</p>
                                                <p className="text-sm text-destructive/80">Reason: {skipReasonText}</p>
                                            </div>
                                        ) : (
                                            <>
                                                {meal.suggestions && (
                                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-md">
                                                        <p className="text-sm text-blue-900 dark:text-blue-100"><MessageSquare className="h-4 w-4 inline mr-2" />Suggestion: {meal.suggestions}</p>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <Label className="text-base font-semibold">Select Food Items:</Label>
                                                    {meal.foodItems.map((item, foodIndex) => {
                                                        const isSelected = selectedIndices.includes(foodIndex);
                                                        return (
                                                            <div key={foodIndex} className={cn("p-4 border rounded-lg transition-all", isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50')}>
                                                                <div className="flex items-start gap-4">
                                                                    <Checkbox
                                                                        id={`meal-${meal.time}-food-${foodIndex}`}
                                                                        checked={isSelected}
                                                                        onCheckedChange={() => handleFoodItemToggle(meal.time, foodIndex)}
                                                                        className="h-6 w-6 mt-1"
                                                                        disabled={!isMealEditable}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <Label htmlFor={`meal-${meal.time}-food-${foodIndex}`} className={cn("text-base font-medium", isMealEditable && "cursor-pointer")}>
                                                                            {item.foodName} ({item.quantity})
                                                                        </Label>
                                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-center gap-2 text-xs text-muted-foreground mt-2">
                                                                            <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Cals: {item.calories?.toFixed(0) ?? 'N/A'}</span>
                                                                            <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Prot: {item.protein?.toFixed(1) ?? 'N/A'}g</span>
                                                                            <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Fat: {item.fat?.toFixed(1) ?? 'N/A'}g</span>
                                                                            <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Carbs: {item.carbs?.toFixed(1) ?? 'N/A'}g</span>
                                                                            <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Fibre: {item.fibre?.toFixed(1) ?? 'N/A'}g</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {selectedIndices.length > 0 && (
                                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-r-md">
                                                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                                                            Meal Total: {mealTotal.calories.toFixed(0)} Cals, {mealTotal.protein.toFixed(1)}g Protein
                                                        </p>
                                                    </div>
                                                )}

                                                {isMealEditable && (
                                                    <div className="space-y-4 pt-4 border-t">
                                                        <div>
                                                            <Label htmlFor={`notes-${meal.time}`} className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4" />Notes</Label>
                                                            <Textarea id={`notes-${meal.time}`} placeholder="Add any notes about your meal..." value={notes[meal.time] || ""} onChange={(e) => setNotes(prev => ({ ...prev, [meal.time]: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <Label htmlFor={`photo-${meal.time}`} className="flex items-center gap-2 mb-2"><Camera className="h-4 w-4" />Photo</Label>
                                                            <Input id={`photo-${meal.time}`} type="file" accept="image/*" onChange={(e) => handleImageChange(e, meal.time)} />

                                                            {(imagePreviews[meal.time] || savedImageURL) && (
                                                                <div className="mt-4">
                                                                    <Image src={imagePreviews[meal.time] || savedImageURL!} alt="Meal preview" width={100} height={100} className="rounded-md border p-1" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button onClick={() => handleSaveLog(meal.time, meal.title)} disabled={isUploading}>
                                                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                                {isUploading ? 'Saving...' : 'Save Log'}
                                                            </Button>
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="outline" size="sm" onClick={() => { setSkipTarget({ type: 'meal', time: meal.time, title: meal.title }); setSkipReason(''); }}>Skip Meal</Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Skip {meal.title}?</DialogTitle>
                                                                        <DialogDescription>
                                                                            Please provide a reason for skipping this meal.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="py-4">
                                                                        <Textarea
                                                                            placeholder="e.g., Was traveling, felt unwell, attended a party..."
                                                                            value={skipReason}
                                                                            onChange={(e) => setSkipReason(e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <Button variant="secondary" onClick={() => setSkipDialogOpen(false)}>Cancel</Button>
                                                                        <Button variant="destructive" onClick={handleConfirmSkip} disabled={!skipReason.trim()}>
                                                                            Confirm Skip
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                    <CardFooter className="p-4 bg-muted rounded-lg text-sm font-medium sticky bottom-0">
                        <div className="w-full">
                            <h4 className="font-semibold mb-2">Today's Totals (from selected items)</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2 w-full">
                                <span>Total Cals: <span className="font-bold text-primary">{dailyTotals.calories}</span></span>
                                <span>Total Protein: <span className="font-bold text-primary">{dailyTotals.protein}g</span></span>
                                <span>Total Fat: <span className="font-bold text-primary">{dailyTotals.fat}g</span></span>
                                <span>Total Carbs: <span className="font-bold text-primary">{dailyTotals.carbs}g</span></span>
                                <span>Total Fibre: <span className="font-bold text-primary">{dailyTotals.fibre}g</span></span>
                            </div>
                        </div>
                    </CardFooter>
                </>
            )}
        </div>
    );
}
