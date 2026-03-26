
"use client";

import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

const policyLinks = [
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/pricing-policy", label: "Pricing Policy" },
    { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/contact", label: "Contact Us" },
]

export default function ShippingPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl font-bold font-headline">Shipping & Delivery Policy</CardTitle>
              <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Service Delivery</h2>
                <p>Diet Clinik provides digital services, including personalized diet plans, expert consultations, and access to our online platform. As our products are digital and delivered electronically, there are no physical goods to be shipped.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Account Activation</h2>
                <p>Upon successful completion of your payment for a subscription plan, your Diet Clinik account will be activated, and you will gain immediate access to our platform and the services included in your plan. You will receive a confirmation email with your login credentials and instructions on how to get started.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Delivery of Diet Plans</h2>
                <p>Your personalized diet plan will be made available to you through your user dashboard on our website. The timeline for the delivery of your first plan will be communicated to you during the onboarding process, but it is typically available within 24-48 hours after you provide all necessary personal and health-related information.</p>
              </section>
               <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">No Physical Shipping</h2>
                <p>Please note that we do not ship any physical products. All our services and communications are delivered through digital channels, such as our website, your user dashboard, and email. Ensure that you provide a valid and active email address to receive all communications from us.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
                <p>If you have any questions about our Shipping and Delivery Policy or experience any issues accessing our services, please contact our support team immediately.</p>
              </section>
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
          <p className="text-sm text-muted-foreground">App Developed By <a href="https://catchytechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Catchy Technologies</a></p>
        </nav>
      </footer>
    </div>
  );
}
