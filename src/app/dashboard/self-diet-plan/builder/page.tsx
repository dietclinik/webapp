
"use client";

import { useState, useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebouncedCallback } from "use-debounce";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/components/firebase-provider";
import { doc, getDoc, setDoc, addDoc, serverTimestamp, Timestamp, collection } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronLeft, PlusCircle, Trash2, Loader2, Save, BrainCircuit, CalendarIcon, Pencil, Utensils } from "lucide-react";
import { calculateNutrition } from "@/ai/flows/calculate-nutrition-flow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  day: z.string().min(1, "Day name is required."),
  date: z.date(),
  meals: z.array(mealSchema),
});

type DailyLogFormData = z.infer<typeof dailyLogSchema>;

const PRESET_MEALS = [
  { label: "Before Breakfast", time: "05:00", outlineClass: "bg-purple-500 hover:bg-purple-600 text-white border-purple-500", activeClass: "bg-purple-800 hover:bg-purple-900 text-white border-purple-800 ring-2 ring-white dark:ring-purple-300" },
  { label: "Breakfast",        time: "08:00", outlineClass: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500", activeClass: "bg-orange-800 hover:bg-orange-900 text-white border-orange-800 ring-2 ring-white dark:ring-orange-300" },
  { label: "Mid Morning Snacks", time: "11:00", outlineClass: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500", activeClass: "bg-yellow-700 hover:bg-yellow-800 text-white border-yellow-700 ring-2 ring-white dark:ring-yellow-300" },
  { label: "Lunch",            time: "13:00", outlineClass: "bg-green-500 hover:bg-green-600 text-white border-green-500", activeClass: "bg-green-800 hover:bg-green-900 text-white border-green-800 ring-2 ring-white dark:ring-green-300" },
  { label: "Evening Snacks",   time: "16:00", outlineClass: "bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500", activeClass: "bg-cyan-800 hover:bg-cyan-900 text-white border-cyan-800 ring-2 ring-white dark:ring-cyan-300" },
  { label: "Dinner",           time: "19:00", outlineClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500", activeClass: "bg-rose-800 hover:bg-rose-900 text-white border-rose-800 ring-2 ring-white dark:ring-rose-300" },
];

const formatTime12Hour = (time24: string) => {
  if (!time24 || !time24.includes(':')) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

// Single food item row inside the meal dialog
const FoodItemRow = ({ form, mealIndex, foodIndex, removeFood, handleFetchNutrition, isFetchingNutrition }: any) => {
  const uniqueId = `${mealIndex}-${foodIndex}`;
  const isFetching = isFetchingNutrition === uniqueId;

  return (
    <div className="flex items-end gap-2 p-3 border rounded-lg bg-background">
      <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.foodName`} render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel className="text-xs">Food Name</FormLabel>
          <FormControl>
            <Input placeholder="e.g., Oats" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name={`meals.${mealIndex}.foodItems.${foodIndex}.quantity`} render={({ field }) => (
        <FormItem className="w-32">
          <FormLabel className="text-xs flex items-center gap-1">
            Quantity
            {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {!isFetching && <BrainCircuit className="h-3 w-3 text-muted-foreground" />}
          </FormLabel>
          <FormControl>
            <Input placeholder="e.g., 1 bowl" {...field} onBlur={() => handleFetchNutrition(mealIndex, foodIndex)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <Button type="button" variant="ghost" size="icon" className="text-destructive h-9 w-9 shrink-0" onClick={() => removeFood(foodIndex)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Meal entry dialog — shown when user clicks a meal button
const MealEntryDialog = ({ open, onClose, form, mealIndex, handleFetchNutrition, isFetchingNutrition }: any) => {
  const [isEditingTime, setIsEditingTime] = useState(false);

  const { fields: foodFields, append: appendFood, remove: removeFood } = useFieldArray({
    control: form.control,
    name: `meals.${mealIndex}.foodItems`,
  });

  const mealData = useWatch({ control: form.control, name: `meals.${mealIndex}` });
  const totalCalories = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.calories) || 0), 0) ?? 0;
  const totalProtein  = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.protein) || 0), 0) ?? 0;
  const totalFat      = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.fat) || 0), 0) ?? 0;
  const totalCarbs    = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.carbs) || 0), 0) ?? 0;
  const totalFibre    = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.fibre) || 0), 0) ?? 0;

  if (mealIndex === null || mealIndex === undefined) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time field */}
              <FormField control={form.control} name={`meals.${mealIndex}.time`} render={({ field }) => (
                <FormItem className="flex items-center gap-1 m-0">
                  {isEditingTime ? (
                    <FormControl>
                      <Input type="time" {...field} className="w-28 h-8 font-mono text-sm" autoFocus onBlur={() => setIsEditingTime(false)} />
                    </FormControl>
                  ) : (
                    <button type="button" className="flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground" onClick={() => setIsEditingTime(true)}>
                      {formatTime12Hour(field.value) || "Set time"}
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              {/* Title field */}
              <FormField control={form.control} name={`meals.${mealIndex}.title`} render={({ field }) => (
                <FormItem className="flex-1 m-0">
                  <FormControl>
                    <Input {...field} className="text-base font-semibold border-0 bg-transparent shadow-none px-0 h-auto focus-visible:ring-0" placeholder="Meal name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <div className="space-y-3 py-1">
            {foodFields.map((food, foodIndex) => (
              <FoodItemRow
                key={food.id}
                form={form}
                mealIndex={mealIndex}
                foodIndex={foodIndex}
                removeFood={removeFood}
                handleFetchNutrition={handleFetchNutrition}
                isFetchingNutrition={isFetchingNutrition}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => appendFood({ foodName: "", quantity: "", calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 })}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Food Item
            </Button>
          </div>
        </ScrollArea>

        {/* Meal nutrient totals */}
        <div className="border-t pt-3 mt-1">
          <p className="text-xs text-muted-foreground font-medium mb-2">Meal Totals</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="bg-primary/10 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Calories</p>
              <p className="font-bold text-primary text-lg">{totalCalories.toFixed(0)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Protein</p>
              <p className="font-bold text-blue-600 text-lg">{totalProtein.toFixed(1)}g</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Fat</p>
              <p className="font-bold text-orange-600 text-lg">{totalFat.toFixed(1)}g</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Carbs</p>
              <p className="font-bold text-green-600 text-lg">{totalCarbs.toFixed(1)}g</p>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Fibre</p>
              <p className="font-bold text-teal-600 text-lg">{totalFibre.toFixed(1)}g</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function DailyDietLogPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingNutrition, setIsFetchingNutrition] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);

  const { toast } = useToast();
  const { db, auth } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get('logId');

  const form = useForm<DailyLogFormData>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: { day: "New Log", date: new Date(), meals: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "meals" });

  const dayData = useWatch({ control: form.control });
  const dayTotalCalories = dayData.meals?.reduce((mAcc: number, meal: any) => mAcc + (meal.foodItems?.reduce((fAcc: number, item: any) => fAcc + (Number(item.calories) || 0), 0) ?? 0), 0) ?? 0;
  const dayTotalProtein  = dayData.meals?.reduce((mAcc: number, meal: any) => mAcc + (meal.foodItems?.reduce((fAcc: number, item: any) => fAcc + (Number(item.protein) || 0), 0) ?? 0), 0) ?? 0;
  const dayTotalFat      = dayData.meals?.reduce((mAcc: number, meal: any) => mAcc + (meal.foodItems?.reduce((fAcc: number, item: any) => fAcc + (Number(item.fat) || 0), 0) ?? 0), 0) ?? 0;
  const dayTotalCarbs    = dayData.meals?.reduce((mAcc: number, meal: any) => mAcc + (meal.foodItems?.reduce((fAcc: number, item: any) => fAcc + (Number(item.carbs) || 0), 0) ?? 0), 0) ?? 0;
  const dayTotalFibre    = dayData.meals?.reduce((mAcc: number, meal: any) => mAcc + (meal.foodItems?.reduce((fAcc: number, item: any) => fAcc + (Number(item.fibre) || 0), 0) ?? 0), 0) ?? 0;

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!userId || !db) { setIsLoading(false); return; }
    const fetchLog = async () => {
      setIsLoading(true);
      if (logId) {
        try {
          const docSnap = await getDoc(doc(db, `users/${userId}/selfDietPlans`, logId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({ ...data, date: data.date ? (data.date as Timestamp).toDate() : new Date() });
          } else {
            toast({ variant: 'destructive', title: "Error", description: "Log not found." });
            router.push('/dashboard/self-diet-plan');
          }
        } catch {
          toast({ variant: 'destructive', title: "Error", description: "Could not load your log." });
        }
      } else {
        form.reset({ day: format(new Date(), 'EEEE'), date: new Date(), meals: [] });
      }
      setIsLoading(false);
    };
    fetchLog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, db, logId]);

  const handleFetchNutrition = useDebouncedCallback(async (mealIndex: number, foodIndex: number) => {
    const foodItem = form.getValues(`meals.${mealIndex}.foodItems.${foodIndex}`);
    if (!foodItem.foodName || !foodItem.quantity) return;
    const uniqueId = `${mealIndex}-${foodIndex}`;
    setIsFetchingNutrition(uniqueId);
    try {
      const result = await calculateNutrition({ foodQuery: `${foodItem.quantity} of ${foodItem.foodName}` });
      form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.calories`, result.calories, { shouldDirty: true });
      form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.protein`,  result.protein,  { shouldDirty: true });
      form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.fat`,      result.fat,      { shouldDirty: true });
      form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.carbs`,    result.carbs,    { shouldDirty: true });
      form.setValue(`meals.${mealIndex}.foodItems.${foodIndex}.fibre`,    result.fibre,    { shouldDirty: true });
    } catch {
      toast({ variant: "destructive", title: "AI Error", description: "Could not fetch nutrition data." });
    } finally {
      setIsFetchingNutrition(null);
    }
  }, 500);

  const handleOpenPresetMeal = (label: string, time: string) => {
    const meals = form.getValues('meals');
    const existingIdx = meals.findIndex(m => m.title === label);
    if (existingIdx >= 0) {
      setEditingMealIndex(existingIdx);
    } else {
      const newIdx = fields.length;
      append({ time, title: label, foodItems: [] });
      setEditingMealIndex(newIdx);
    }
  };

  const handleOpenOtherFood = () => {
    const newIdx = fields.length;
    append({ time: "21:00", title: "Other Food", foodItems: [] });
    setEditingMealIndex(newIdx);
  };

  const onSubmit = async (data: DailyLogFormData) => {
    if (!userId || !db) return;
    setIsSubmitting(true);
    const dataToSave = { ...data, updatedAt: serverTimestamp() };
    try {
      if (logId) {
        await setDoc(doc(db, `users/${userId}/selfDietPlans`, logId), dataToSave, { merge: true });
        toast({ title: "Success", description: "Diet log updated." });
      } else {
        await addDoc(collection(db, `users/${userId}/selfDietPlans`), dataToSave);
        toast({ title: "Success", description: "Diet log created." });
      }
      router.push('/dashboard/self-diet-plan');
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save your diet log." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Link href="/dashboard/self-diet-plan">
                  <Button variant="outline" size="icon" type="button">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <CardTitle>{logId ? "Edit Diet Log" : "Add New Diet Log"}</CardTitle>
                  <CardDescription>Log your daily food intake. AI auto-calculates nutrition values.</CardDescription>
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
            {/* Day name + Date */}
            <div className="flex flex-col sm:flex-row gap-4">
              <FormField control={form.control} name="day" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Day Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Monday" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
              )} />
            </div>

            {/* Meal buttons */}
            <div>
              <p className="text-sm font-semibold mb-3">Add Meals</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_MEALS.map(meal => {
                  const isAdded = dayData.meals?.some((m: any) => m.title === meal.label);
                  return (
                    <Button
                      key={meal.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPresetMeal(meal.label, meal.time)}
                      className={cn("gap-1 border font-medium transition-colors", isAdded ? meal.activeClass : meal.outlineClass)}
                    >
                      {isAdded ? <Pencil className="h-3 w-3" /> : <PlusCircle className="h-3 w-3" />}
                      {meal.label}
                    </Button>
                  );
                })}
                <Button type="button" variant="outline" size="sm" onClick={handleOpenOtherFood} className="gap-1 border-slate-400 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/20">
                  <PlusCircle className="h-3 w-3" /> Other Food
                </Button>
              </div>
            </div>

            {/* Added meals summary list */}
            {fields.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Logged Meals</p>
                <div className="grid gap-2">
                  {fields.map((field, index) => {
                    const mealData = dayData.meals?.[index];
                    const mealCalories = mealData?.foodItems?.reduce((acc: number, item: any) => acc + (Number(item.calories) || 0), 0) ?? 0;
                    const foodCount = mealData?.foodItems?.length ?? 0;
                    return (
                      <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{mealData?.title || "Meal"}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime12Hour(mealData?.time || "") && `${formatTime12Hour(mealData?.time || "")} · `}
                              {foodCount} item{foodCount !== 1 ? 's' : ''} · {mealCalories.toFixed(0)} kcal
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingMealIndex(index)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            remove(index);
                            if (editingMealIndex === index) setEditingMealIndex(null);
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily nutrition totals */}
            <div className="rounded-xl border bg-primary/5 p-4">
              <p className="text-sm font-semibold mb-3">Daily Nutrition Total</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="text-2xl font-bold text-primary">{dayTotalCalories.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="text-2xl font-bold">{dayTotalProtein.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">g</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="text-2xl font-bold">{dayTotalFat.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">g</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="text-2xl font-bold">{dayTotalCarbs.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">g</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Fibre</p>
                  <p className="text-2xl font-bold">{dayTotalFibre.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">g</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meal entry dialog */}
        {editingMealIndex !== null && (
          <MealEntryDialog
            open={editingMealIndex !== null}
            onClose={() => setEditingMealIndex(null)}
            form={form}
            mealIndex={editingMealIndex}
            handleFetchNutrition={handleFetchNutrition}
            isFetchingNutrition={isFetchingNutrition}
          />
        )}
      </form>
    </Form>
  );
}
