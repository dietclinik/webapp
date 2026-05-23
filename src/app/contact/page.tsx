
"use client";

import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { createContactSubmission } from "@/ai/flows/create-contact-submission-flow";
import { useSettings } from "@/hooks/use-settings";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  mobile: z.string().regex(/^\d{10}$/, "Must be a valid 10-digit mobile number."),
  subject: z.string().min(5, "Subject must be at least 5 characters."),
  message: z.string().min(10, "Message must be at least 10 characters long."),
});

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
];

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings } = useSettings();

  const contactSettings = settings?.contactPageSettings || {
    email: 'support@dietclinik.com',
    phone: '+91 12345 67890',
    address: '123 Health St, Wellness City, 456001',
    googleMapsUrl: '',
  };

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
        name: "",
        email: "",
        mobile: "",
        subject: "",
        message: ""
    }
  });

  const onSubmit = async (data: z.infer<typeof contactFormSchema>) => {
    setIsSubmitting(true);
    try {
        const result = await createContactSubmission(data);
        if(result.success) {
            toast({
                title: "Message Sent!",
                description: "Thank you for contacting us. We will get back to you shortly.",
                variant: "success",
            });
            form.reset();
        } else {
            throw new Error("Failed to send message.");
        }
    } catch (error) {
        toast({
            title: "Submission Failed",
            description: "An error occurred while sending your message. Please try again later.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
    // Regex to extract the src from an iframe tag
    const mapSrcMatch = contactSettings.googleMapsUrl?.match(/src="([^"]+)"/);
    const mapSrc = mapSrcMatch ? mapSrcMatch[1] : '';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold font-headline">Contact Us</CardTitle>
              <CardDescription>We'd love to hear from you. Fill out the form below or use our contact details.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold">Send us a Message</h3>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" {...form.register("name")} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...form.register("email")} />
                             {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mobile">Mobile Number</Label>
                            <Input id="mobile" type="tel" {...form.register("mobile")} />
                             {form.formState.errors.mobile && <p className="text-sm text-destructive">{form.formState.errors.mobile.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" {...form.register("subject")} />
                            {form.formState.errors.subject && <p className="text-sm text-destructive">{form.formState.errors.subject.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="message">Message</Label>
                            <Textarea id="message" {...form.register("message")} rows={5} />
                             {form.formState.errors.message && <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>}
                        </div>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Message
                        </Button>
                    </form>
                </div>
                 <div className="space-y-6 rounded-lg bg-muted/50 p-6">
                    <h3 className="text-xl font-semibold">Contact Information</h3>
                    <div className="space-y-4 text-muted-foreground">
                        <div className="flex items-start gap-4">
                            <Mail className="h-5 w-5 mt-1 text-primary" />
                            <div>
                                <h4 className="font-semibold text-foreground">Email</h4>
                                <a href={`mailto:${contactSettings.email}`} className="hover:underline">{contactSettings.email}</a>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Phone className="h-5 w-5 mt-1 text-primary" />
                            <div>
                                <h4 className="font-semibold text-foreground">Phone</h4>
                                <p>{contactSettings.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <MapPin className="h-5 w-5 mt-1 text-primary" />
                            <div>
                                <h4 className="font-semibold text-foreground">Address</h4>
                                <p>{contactSettings.address}</p>
                            </div>
                        </div>
                    </div>
                     {mapSrc && (
                        <div className="mt-6">
                            <h3 className="text-xl font-semibold mb-4">Our Location</h3>
                             <iframe
                                src={mapSrc}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen={false}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="rounded-md"
                            ></iframe>
                        </div>
                     )}
                 </div>
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
          <p className="text-sm text-muted-foreground">App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Vorynto Pvt. Ltd.</a></p>
        </nav>
      </footer>
    </div>
  );
}
