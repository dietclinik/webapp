
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebouncedCallback } from "use-debounce";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PlusCircle, Trash2, Loader2, Save, BrainCircuit, Edit, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { calculateNutrition } from "@/ai/flows/calculate-nutrition-flow";
import { Textarea } from "@/components/ui/textarea";

const foodItemSchema = z.object({
    foodName: z.string().min(1, "Food name is required."),
    quantity: z.string().min(1, "Quantity is required."),
    calories: z.number().optional().default(0),
    protein: z.number().optional().default(0),
    fat: z.number().optional().default(0),
    carbs: z.number().optional().default(0),
    fibre: z.number().optional().default(0),
});

const mealSchema = z.object({
    time: z.string().min(1, "Time is required."),
    title: z.string().min(1, "Title is required."),
    foodItems: z.array(foodItemSchema).min(1, "Each meal must have at least one food item."),
    suggestions: z.string().optional(),
});

const dietPlanSchema = z.object({
    name: z.string().min(2, "Plan name is required."),
    target: z.string().min(3, "Target is required."),
    meals: z.array(mealSchema),
});

type DietPlanFormData = z.infer<typeof dietPlanSchema>;

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


const FoodItemCard = ({ form, mealIndex, foodIndex, removeFood, handleFetchNutrition, isFetchingNutrition }: any) => {
    const uniqueId = `${mealIndex}-${foodIndex}`;
    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2 border rounded-md relative items-start bg-background/50">
            <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.foodName`} render={({ field }) => (
                <FormItem className="md:col-span-3"><FormLabel>Food</FormLabel><FormControl><Input placeholder="Oats with berries" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.quantity`} render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Quantity</FormLabel><FormControl><Input placeholder="1 bowl" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="md:col-span-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.calories`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Cals</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.protein`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Protein</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.fat`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Fat</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.carbs`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Carbs</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>)} />
                <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.fibre`} render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{isFetchingNutrition === uniqueId ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Fibre</FormLabel><FormControl><Input readOnly {...field} className="bg-muted/50" /></FormControl></FormItem>)} />
            </div>
            <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeFood(foodIndex)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

const MealCard = ({ form, mealIndex, removeMeal, handleFetchNutrition, isFetchingNutrition }: any) => {
    const { fields: foodFields, append: appendFood, remove: removeFood } = useFieldArray({
        control: form.control,
        name: `meals.${mealIndex}.foodItems`,
    });

    const [isEditingTime, setIsEditingTime] = useState(false);

    const mealData = useWatch({ control: form.control, name: `meals.${mealIndex}` });
    const totalCalories = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.calories) || 0), 0);
    const totalProtein = mealData.foodItems.reduce((acc: number, item: any) => acc + (Number(item.protein) || 0), 0);

    return (
        <Card className="mb-6 bg-muted/20">
            <CardHeader className="flex-row items-center justify-between">
                <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                    <FormField control={form.control} name={`meals.${mealIndex}.time`} render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                            {isEditingTime ? (
                                <FormControl><Input type="time" {...field} className="text-lg font-semibold border-2 border-primary shadow-none px-1 w-32" autoFocus onBlur={() => setIsEditingTime(false)} /></FormControl>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-semibold">{formatTime12Hour(field.value)}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setIsEditingTime(true)} className="text-blue-500">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name={`meals.${mealIndex}.title`} render={({ field }) => (
                        <FormItem className="flex-1 md:max-w-xs"><FormControl><Input placeholder="e.g., Breakfast" {...field} className="text-lg font-semibold border-0 bg-transparent shadow-none px-1" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <Button type="button" variant="destructive" size="icon" onClick={() => removeMeal(mealIndex)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {foodFields.map((food, foodIndex) => (
                    <FoodItemCard key={food.id} {...{ form, mealIndex, foodIndex, removeFood, handleFetchNutrition, isFetchingNutrition }} />
                ))}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => appendFood({ foodName: "", quantity: "", calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Food Item
                    </Button>
                    <div className="text-sm font-medium text-muted-foreground">
                        Meal Total - Cals: <span className="text-primary font-bold">{totalCalories.toFixed(0)}</span>, Protein: <span className="text-primary font-bold">{totalProtein.toFixed(1)}g</span>
                    </div>
                </div>
                <div className="space-y-2 pt-4 border-t">
                    <FormField control={form.control} name={`meals.${mealIndex}.suggestions`} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Suggestions (Optional)
                            </FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., Drink a glass of warm water after this meal." {...field} value={field.value || ""} />
                            </FormControl>
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>
    );
}

export default function DietPlanBuilderPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingNutrition, setIsFetchingNutrition] = useState<string | null>(null);
    const { toast } = useToast();
    const { db, auth } = useFirebase();
    const router = useRouter();
    const searchParams = useSearchParams();
    const planId = searchParams.get('planId');

    const form = useForm<DietPlanFormData>({
        resolver: zodResolver(dietPlanSchema),
        defaultValues: {
            name: "",
            target: "",
            meals: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "meals",
    });

    const allMeals = useWatch({ control: form.control, name: 'meals' });
    const dayTotals = React.useMemo(() => {
        let calories = 0, protein = 0, fat = 0, carbs = 0, fibre = 0;
        allMeals?.forEach(meal => {
            meal.foodItems?.forEach(item => {
                calories += item.calories || 0;
                protein += item.protein || 0;
                fat += item.fat || 0;
                carbs += item.carbs || 0;
                fibre += item.fibre || 0;
            });
        });
        return { calories, protein, fat, carbs, fibre };
    }, [allMeals]);


    const handleAddMeal = () => {
        const currentMealCount = fields.length;
        const nextMeal = defaultMeals[currentMealCount % defaultMeals.length] || { time: "21:00", title: "Post-Dinner" };
        append({
            time: nextMeal.time,
            title: nextMeal.title,
            foodItems: [{ foodName: "", quantity: "", calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }]
        });
    };

    const handleFetchNutrition = useDebouncedCallback(async (mealIndex: number, foodIndex: number) => {
        const foodItem = form.getValues(`meals.${mealIndex}.foodItems.${foodIndex}`);
        if (!foodItem || !foodItem.foodName || !foodItem.quantity) return;

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


    useEffect(() => {
        if (!db) {
            setIsLoading(false);
            return;
        };

        const fetchPlanData = async () => {
            setIsLoading(true);
            if (planId) {
                try {
                    const planDocRef = doc(db, "dietPlans", planId);
                    const docSnap = await getDoc(planDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data() as any;

                        // Handle both old and new structure
                        let meals = data.meals || [];
                        if (meals.length > 0 && meals[0].options) {
                            // Old structure: convert options to flat food items
                            meals = meals.map((meal: any) => ({
                                time: meal.time,
                                title: meal.title,
                                suggestions: meal.suggestions,
                                foodItems: meal.options?.[0]?.foodItems || []
                            }));
                        }

                        form.reset({
                            name: data.name || "",
                            target: data.target || data.focus || "",
                            meals: meals,
                        });
                    } else {
                        toast({ variant: "destructive", title: "Error", description: "Diet plan not found." });
                        router.push("/staff/diet-plans");
                    }
                } catch (error) {
                    console.error("Error fetching diet plan:", error);
                    toast({ variant: "destructive", title: "Error", description: "Could not load diet plan data." });
                }
            } else {
                form.reset({
                    name: "",
                    target: "",
                    meals: [
                        { time: "05:00", title: "Before Breakfast", foodItems: [] }
                    ],
                })
            }
            setIsLoading(false);
        };

        fetchPlanData();
    }, [db, planId, form, router, toast]);

    const onSubmit = async (data: DietPlanFormData) => {
        if (!db || !auth?.currentUser) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to save a plan." });
            return;
        }
        setIsSubmitting(true);

        const planData = {
            ...data,
            meals: data.meals.map(meal => ({
                ...meal,
                suggestions: meal.suggestions || null,
            })),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            ...(!planId && { created: format(new Date(), "yyyy-MM-dd") })
        };

        try {
            if (planId) {
                const planDocRef = doc(db, "dietPlans", planId);
                await setDoc(planDocRef, planData, { merge: true });
                toast({ title: "Success", description: "Diet plan updated successfully." });
            } else {
                const collectionRef = collection(db, "dietPlans");
                await addDoc(collectionRef, planData);
                toast({ title: "Success", description: "Diet plan created successfully." });
            }
            router.push("/staff/diet-plans");
        } catch (error) {
            console.error("Error saving diet plan:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save diet plan." });
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
                <div className="relative pb-24">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Link href="/staff/diet-plans">
                                    <Button variant="outline" size="icon" type="button">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <div>
                                    <CardTitle>{planId ? "Edit Diet Plan" : "Create New Diet Plan"}</CardTitle>
                                    <CardDescription>Build a flexible diet chart with multi-select food items. Use AI to auto-calculate nutrition.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Card>
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Plan Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Weight Loss Basic" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="target"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Target</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., 2Kg, 5Kg, 10Kg .." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <div>
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
                            </div>

                            <Button type="button" variant="default" onClick={handleAddMeal}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Meal
                            </Button>

                        </CardContent>
                        <CardFooter className="grid grid-cols-2 md:grid-cols-5 gap-4 text-lg font-semibold text-muted-foreground bg-muted p-4 rounded-b-lg">
                            <p>Daily Cals: <span className="text-primary">{dayTotals.calories.toFixed(0)}</span></p>
                            <p>Daily Protein: <span className="text-primary">{dayTotals.protein.toFixed(1)}g</span></p>
                            <p>Daily Fat: <span className="text-primary">{dayTotals.fat.toFixed(1)}g</span></p>
                            <p>Daily Carbs: <span className="text-primary">{dayTotals.carbs.toFixed(1)}g</span></p>
                            <p>Daily Fibre: <span className="text-primary">{dayTotals.fibre.toFixed(1)}g</span></p>
                        </CardFooter>
                    </Card>

                    <div className="fixed bottom-0 left-0 md:left-[4.5rem] right-0 bg-background/80 backdrop-blur-sm border-t p-4 z-10">
                        <div className="max-w-7xl mx-auto flex items-center justify-end">
                            <Button type="submit" disabled={isSubmitting || isFetchingNutrition !== null}>
                                {(isSubmitting || !!isFetchingNutrition) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                {isSubmitting ? "Saving..." : isFetchingNutrition ? "Calculating..." : "Save Plan"}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </Form>
    );
}
