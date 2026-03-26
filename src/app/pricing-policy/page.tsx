
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

export default function PricingPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl font-bold font-headline">Pricing Policy</CardTitle>
              <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">General Pricing</h2>
                <p>All prices for subscription plans offered by Diet Clinik are listed on our website. We strive to ensure that all pricing information is accurate and up-to-date. Prices are quoted in Indian Rupees (INR) and are inclusive of all applicable taxes unless stated otherwise.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Subscription Plans</h2>
                <p>Our services are offered through various subscription plans, each with a specific duration (e.g., monthly, quarterly, annually) and set of features. The details and price of each plan are clearly outlined on our pricing page. By purchasing a subscription, you agree to the price and terms of that plan at the time of purchase.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Payment</h2>
                <p>Payments for subscription plans are processed through our third-party payment gateway, Razorpay. We accept various payment methods as supported by the gateway. Your subscription will be activated upon successful confirmation of payment.</p>
              </section>
               <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to Pricing</h2>
                <p>Diet Clinik reserves the right to modify or update its pricing at any time. Any changes to pricing for subscription plans will be communicated to existing users in advance. Price changes will not affect any active subscription period and will only apply to new subscriptions or renewals after the date of the change.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
                <p>If you have any questions about our Pricing Policy, please contact us through the information provided on our website.</p>
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
