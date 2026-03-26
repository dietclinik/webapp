
"use client";

import { useState, useEffect, useCallback } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebouncedCallback } from "use-debounce";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, setDoc, addDoc, serverTimestamp, Timestamp, collection } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronLeft, PlusCircle, Trash2, Loader2, Save, BrainCircuit, Copy, CalendarIcon, Edit } from "lucide-react";
import { calculateNutrition } from "@/ai/flows/calculate-nutrition-flow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const foodItemSchema = z.object({
  foodName: z.string().min(1, "Food name is required."),
  quantity: z.string().min(1, "Quantity is required."),
  calories: z.number().default(0),
  protein: z.number().default(0),
  fat: z.number().default(0),
  carbs: z.number().default(0),
  fibre: z.number().optional().default(0),
});

const mealSchema = z.object({
  time: z.string().min(1, "Time is required."),
  title: z.string().min(1, "Title is required."),
  foodItems: z.array(foodItemSchema),
});

const dailyLogSchema = z.object({
  day: z.string().min(1, "Day name is required (e.g., Day 1, Monday)."),
  date: z.date(),
  meals: z.array(mealSchema),
});

type DailyLogFormData = z.infer<typeof dailyLogSchema>;

const defaultMeals = [
    { time: "05:00", title: "Before Breakfast" },
    { time: "08:00", title: "Breakfast" },
    { time: "11:00", title: "Mid-Morning Snacks" },
    { time: "13:00", title: "Lunch" },
    { time: "16:00", title: "Evening Snacks" },
    { time: "19:00", title: "Dinner" },
];

const formatTime12Hour = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 'N/A';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

const MealCard = ({ form, mealIndex, removeMeal, handleFetchNutrition, isFetchingNutrition }: any) => {
    const { fields: foodFields, append: appendFood, remove: removeFood } = useFieldArray({
        control: form.control,
        name: `meals.${mealIndex}.foodItems`,
    });

    const mealData = useWatch({ control: form.control, name: `meals.${mealIndex}` });
    const totalCalories = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.calories) || 0), 0);
    const totalProtein = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.protein) || 0), 0);
    const totalFat = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.fat) || 0), 0);
    const totalCarbs = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.carbs) || 0), 0);

    const [isEditingTime, setIsEditingTime] = useState(false);

    return (
        <Card className="bg-muted/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                     <div className="flex-1 flex items-center gap-2">
                        <FormField control={form.control} name={`meals.${mealIndex}.time`} render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                                {isEditingTime ? (
                                    <FormControl><Input type="time" {...field} className="text-lg font-semibold border-2 border-primary shadow-none px-1 w-32" autoFocus onBlur={() => setIsEditingTime(false)} /></FormControl>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-semibold">{formatTime12Hour(field.value)}</span>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setIsEditingTime(true)} className="text-blue-500">
                                            <Edit className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                )}
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name={`meals.${mealIndex}.title`} render={({ field }) => (
                            <FormItem className="flex-1"><FormControl><Input placeholder="e.g., Breakfast" {...field} className="text-lg font-semibold border-0 bg-transparent shadow-none px-1" /></FormControl><FormMessage /></FormItem>
                        )} />
                     </div>
                       <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeMeal(mealIndex)}>
                          <Trash2 className="h-4 w-4" />
                      </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
               {foodFields.map((food, foodIndex) => {
                   const uniqueId = `${mealIndex}-${foodIndex}`;
                   return (
                      <div key={food.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2 border rounded-md relative items-start bg-background">
                          <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.foodName`} render={({ field }) => (
                              <FormItem className="md:col-span-3"><FormLabel>Food</FormLabel><FormControl><Input placeholder="Oats with berries" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.quantity`} render={({ field }) => (
                              <FormItem className="md:col-span-2"><FormLabel>Quantity</FormLabel><FormControl><Input placeholder="1 bowl" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)}/></FormControl><FormMessage /></FormItem>
                          )} />
                          <div className="md:col-span-6 grid grid-cols-2 md:grid-cols-5 gap-2">
                              <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.calories`} render={({field}) => (
                                <FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3 w-3"/>} Cals</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.protein`} render={({field}) => (
                                <FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3 w-3"/>} Protein</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50"/></FormControl></FormItem>
                               )} />
                               <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.fat`} render={({field}) => (
                                <FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3 w-3"/>} Fat</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50"/></FormControl></FormItem>
                               )} />
                               <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.carbs`} render={({field}) => (
                                <FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3 w-3"/>} Carbs</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50"/></FormControl></FormItem>
                               )} />
                               <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.fibre`} render={({field}) => (
                                <FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3 w-3"/>} Fibre</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50"/></FormControl></FormItem>
                               )} />
                          </div>
                           <div className="flex items-end">
                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeFood(foodIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                      </div>
                   )
               })}
               <Button type="button" variant="outline" size="sm" onClick={() => appendFood({ foodName: "", quantity: "", calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Food Item
                </Button>
            </CardContent>
            <CardFooter className="text-sm font-medium text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                <p>Meal Cals: <span className="text-primary font-bold">{totalCalories.toFixed(0)}</span></p>
                <p>Meal Protein: <span className="text-primary font-bold">{totalProtein.toFixed(1)}g</span></p>
                <p>Meal Fat: <span className="text-primary font-bold">{totalFat.toFixed(1)}g</span></p>
                <p>Meal Carbs: <span className="text-primary font-bold">{totalCarbs.toFixed(1)}g</span></p>
            </CardFooter>
        </Card>
    );
}


export default function DailyDietLogPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingNutrition, setIsFetchingNutrition] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const { toast } = useToast();
    const { db, auth } = useFirebase();
    const router = useRouter();
    const searchParams = useSearchParams();
    const logId = searchParams.get('logId');

    const form = useForm<DailyLogFormData>({
        resolver: zodResolver(dailyLogSchema),
        defaultValues: {
            day: "New Log",
            date: new Date(),
            meals: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "meals",
    });

    const dayData = useWatch({ control: form.control });
    const dayTotalCalories = dayData.meals?.reduce((mealAcc: number, meal: any) => mealAcc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.calories) || 0), 0), 0) || 0;
    const dayTotalProtein = dayData.meals?.reduce((mealAcc: number, meal: any) => mealAcc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.protein) || 0), 0), 0) || 0;
    const dayTotalFat = dayData.meals?.reduce((mealAcc: number, meal: any) => mealAcc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.fat) || 0), 0), 0) || 0;
    const dayTotalCarbs = dayData.meals?.reduce((mealAcc: number, meal: any) => mealAcc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.carbs) || 0), 0), 0) || 0;
    const dayTotalFibre = dayData.meals?.reduce((mealAcc: number, meal: any) => mealAcc + meal.foodItems.reduce((foodAcc: number, item: any) => foodAcc + (Number(item.fibre) || 0), 0), 0) || 0;
    
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserId(user ? user.uid : null);
        });
        return () => unsubscribe();
    }, [auth]);

    useEffect(() => {
        if (!userId || !db) {
            setIsLoading(false);
            return;
        }

        const fetchLog = async () => {
            setIsLoading(true);
            if(logId) {
                 const logDocRef = doc(db, `users/${userId}/selfDietPlans`, logId);
                 try {
                    const docSnap = await getDoc(logDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        form.reset({
                             ...data,
                            date: data.date ? (data.date as Timestamp).toDate() : new Date(),
                        });
                    } else {
                        toast({ variant: 'destructive', title: "Error", description: "Log not found." });
                        router.push('/dashboard/self-diet-plan');
                    }
                } catch (error) {
                    console.error("Error fetching diet log:", error);
                    toast({ variant: 'destructive', title: "Error", description: "Could not load your log." });
                }
            } else {
                form.reset({ day: "Today's Log", date: new Date(), meals: [{ time: "05:00", title: "Before Breakfast", foodItems: [] }]});
            }
            setIsLoading(false);
        };

        fetchLog();
    }, [userId, db, logId, form, toast, router]);


    const handleFetchNutrition = useDebouncedCallback(async (mealIndex: number, foodIndex: number) => {
        const foodItem = form.getValues(`meals.${mealIndex}.foodItems.${foodIndex}`);
        if (!foodItem.foodName || !foodItem.quantity) return;

        const uniqueId = `${mealIndex}-${foodIndex}`;
        setIsFetchingNutrition(uniqueId);
        try {
            const result = await calculateNutrition({ foodQuery: `${foodItem.quantity} of ${foodItem.foodName}` });
            form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.calories`, result.calories, { shouldDirty: true });
            form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.protein`, result.protein, { shouldDirty: true });
            form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.fat`, result.fat, { shouldDirty: true });
            form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.carbs`, result.carbs, { shouldDirty: true });
            form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.fibre`, result.fibre, { shouldDirty: true });
        } catch (error) {
            console.error("Error fetching nutrition data:", error);
            toast({ variant: "destructive", title: "AI Error", description: "Could not fetch nutrition data." });
        } finally {
            setIsFetchingNutrition(null);
        }
    }, 500);

    const handleAddMeal = () => {
        const currentMealCount = fields.length;
        const nextMeal = defaultMeals[currentMealCount % defaultMeals.length] || { time: "21:00", title: "Post-Dinner" };
        append({ 
            time: nextMeal.time, 
            title: nextMeal.title, 
            foodItems: [] 
        });
    };

    const onSubmit = async (data: DailyLogFormData) => {
        if (!userId || !db) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to save a log." });
            return;
        }
        setIsSubmitting(true);
        const dataToSave = {
            ...data,
            updatedAt: serverTimestamp(),
        };

        try {
            if (logId) {
                const logDocRef = doc(db, `users/${userId}/selfDietPlans`, logId);
                await setDoc(logDocRef, dataToSave, { merge: true });
                toast({ title: "Success", description: "Your diet log has been updated." });
            } else {
                 const collectionRef = collection(db, `users/${userId}/selfDietPlans`);
                 await addDoc(collectionRef, dataToSave);
                 toast({ title: "Success", description: "Your diet log has been created." });
            }
            router.push('/dashboard/self-diet-plan');
        } catch (error) {
            console.error("Error saving diet log:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save your diet log." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/dashboard/self-diet-plan">
                                    <Button variant="outline" size="icon" type="button">
                                    <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <div>
                                    <CardTitle>{logId ? "Edit Diet Log" : "Add New Diet Log"}</CardTitle>
                                    <CardDescription>Log the food you've eaten for a specific day. Use our AI to automatically calculate nutrition facts.</CardDescription>
                                </div>
                            </div>
                            <Button type="submit" disabled={isSubmitting || !!isFetchingNutrition}>
                                {(isSubmitting || !!isFetchingNutrition) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                {isSubmitting ? "Saving..." : isFetchingNutrition ? "Calculating..." : "Save Log"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Card>
                             <CardContent className="p-6 flex items-center gap-4">
                                <FormField
                                    control={form.control}
                                    name="day"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Day Name</FormLabel>
                                            <FormControl><Input placeholder="e.g., Monday" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                        {fields.map((field, index) => (
                            <MealCard 
                                key={field.id} 
                                form={form} 
                                mealIndex={index} 
                                removeMeal={remove}
                                handleFetchNutrition={handleFetchNutrition}
                                isFetchingNutrition={isFetchingNutrition}
                            />
                        ))}
                        <Button type="button" variant="secondary" onClick={handleAddMeal}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Meal
                        </Button>
                    </CardContent>
                     <CardFooter className="grid grid-cols-2 md:grid-cols-5 gap-4 text-lg font-semibold text-muted-foreground bg-muted p-4 rounded-b-lg">
                        <p>Daily Cals: <span className="text-primary">{dayTotalCalories.toFixed(0)}</span></p>
                        <p>Daily Protein: <span className="text-primary">{dayTotalProtein.toFixed(1)}g</span></p>
                        <p>Daily Fat: <span className="text-primary">{dayTotalFat.toFixed(1)}g</span></p>
                        <p>Daily Carbs: <span className="text-primary">{dayTotalCarbs.toFixed(1)}g</span></p>
                        <p>Daily Fibre: <span className="text-primary">{dayTotalFibre.toFixed(1)}g</span></p>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
