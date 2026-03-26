
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy } from "lucide-react";
import { registerFITTBOSSChallenge } from "@/ai/flows/FITTBOSS-register-flow";
import RazorpayButton from "@/components/razorpay-button";

const formSchema = z.object({
  gymName: z.string().min(2, "Gym name is required."),
  gymOwnerName: z.string().min(2, "Owner name is required."),
  gymContactNumber: z.string().min(1, "Contact number is required."),
  participantName: z.string().min(2, "Participant name is required."),
  participantAge: z.coerce.number().min(16, "Participant must be at least 16 years old."),
  participantWeight: z.coerce.number().min(30, "Weight must be a realistic value."),
  participantTShirtSize: z.string().min(1, "T-shirt size is required."),
});

export default function FitbossRegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gymName: "",
      gymOwnerName: "",
      gymContactNumber: "",
      participantName: "",
      participantAge: "" as any,
      participantWeight: "" as any,
      participantTShirtSize: "",
    },
  });

  const handlePaymentResult = async (success: boolean, regId: string | null) => {
      if (!regId) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not link payment to registration. Please contact support.' });
          setIsSubmitting(false);
          return;
      }
      try {
        await registerFITTBOSSChallenge({
            registrationId: regId,
            paymentSuccess: success,
        });
        if (success) {
          toast({ title: "Registration Complete!", description: "Thank you for registering for the FITTBOSS Challenge." });
          router.push('/');
        } else {
          toast({ variant: 'destructive', title: "Payment Failed", description: "Your registration details are saved, but payment failed." });
        }
      } catch (error: any) {
         toast({ variant: "destructive", title: "Finalization Error", description: `An error occurred: ${error.message}` });
      } finally {
        setIsSubmitting(false);
      }
  };

  const onBeforePayment = async (): Promise<string | null> => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({ variant: 'destructive', title: 'Invalid Form', description: 'Please fill all required fields correctly.' });
      return null;
    }
    
    setIsSubmitting(true);
    const data = form.getValues();

    try {
      const result = await registerFITTBOSSChallenge({
        gymName: data.gymName,
        gymOwnerName: data.gymOwnerName,
        gymContactNumber: data.gymContactNumber,
        participantName: data.participantName,
        participantAge: Number(data.participantAge),
        participantWeight: Number(data.participantWeight),
        participantTShirtSize: data.participantTShirtSize,
        paymentSuccess: false,
      });

      if (result.registrationId) {
        return result.registrationId;
      } else {
        throw new Error(result.message || "Failed to create pre-payment record.");
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Submission Error', description: `Could not save registration: ${error.message}` });
      setIsSubmitting(false); // Make sure to stop loading on pre-payment failure
      return null;
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1 flex items-center justify-center py-12">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 text-primary mx-auto" />
            <CardTitle className="text-xl font-bold font-headline leading-snug mt-2">FITTBOSS - Champions of Chennai 2026</CardTitle>
            <CardDescription>Register your gym member for the challenge. Entry fee: ₹3000</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form>
              <CardContent className="space-y-6">
                <fieldset className="border p-4 rounded-md">
                  <legend className="text-lg font-semibold px-2">Gym Details</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <FormField control={form.control} name="gymName" render={({ field }) => (<FormItem><FormLabel>Gym Name *</FormLabel><FormControl><Input placeholder="Fitness Universe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="gymOwnerName" render={({ field }) => (<FormItem><FormLabel>Gym Owner Name *</FormLabel><FormControl><Input placeholder="John Smith" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="gymContactNumber" render={({ field }) => (<FormItem><FormLabel>Gym Contact Number *</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </fieldset>
                <fieldset className="border p-4 rounded-md">
                  <legend className="text-lg font-semibold px-2">Participant Details</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                     <FormField control={form.control} name="participantName" render={({ field }) => (<FormItem><FormLabel>Participant Name *</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="participantAge" render={({ field }) => (<FormItem><FormLabel>Age *</FormLabel><FormControl><Input type="number" placeholder="25" {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="participantWeight" render={({ field }) => (<FormItem><FormLabel>Weight (kg) *</FormLabel><FormControl><Input type="number" placeholder="65" {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="participantTShirtSize" render={({ field }) => (
                         <FormItem>
                             <FormLabel>T-Shirt Size *</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                 <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                                 <SelectContent>
                                    <SelectItem value="XL">XL</SelectItem>
                                    <SelectItem value="XXL">XXL</SelectItem>
                                    <SelectItem value="3XL">3XL</SelectItem>
                                    <SelectItem value="4XL">4XL</SelectItem>
                                    <SelectItem value="5XL">5XL</SelectItem>
                                 </SelectContent>
                             </Select>
                             <FormMessage />
                         </FormItem>
                     )}/>
                  </div>
                </fieldset>
              </CardContent>
              <CardFooter>
                 <RazorpayButton
                    planName="FITTBOSS Challenge"
                    amount={3000}
                    customerName={form.getValues().participantName}
                    customerEmail={form.getValues().gymOwnerName.replace(/\s/g, '').toLowerCase() + '@fittboss.gym'} // dummy email
                    customerPhone={form.getValues().gymContactNumber}
                    onPaymentSuccess={(res) => handlePaymentResult(true, res.registrationId)}
                    onPaymentError={(err) => handlePaymentResult(false, err.registrationId)}
                    onBeforePayment={onBeforePayment}
                    disabled={isSubmitting}
                    buttonText={isSubmitting ? "Processing..." : "Submit & Pay ₹3000"}
                />
              </CardFooter>
            </form>
          </Form>
        </Card>
      </main>
    </div>
  );
}
