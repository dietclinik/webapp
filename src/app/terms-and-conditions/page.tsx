
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

export default function TermsAndConditionsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl font-bold font-headline">Terms and Conditions</CardTitle>
              <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
                <p>Welcome to Diet Clinik. These Terms and Conditions govern your use of our website and services. By accessing or using our service, you agree to be bound by these terms. If you disagree with any part of the terms, then you may not access the service.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. Services</h2>
                <p>Diet Clinik provides personalized diet plans, nutritional advice, and progress tracking tools. Our services are for informational purposes only and are not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h2>
                <p>To use our services, you must register for an account. You agree to provide accurate, current, and complete information during the registration process. You are responsible for safeguarding your password and for any activities or actions under your account.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Intellectual Property</h2>
                <p>The service and its original content, features, and functionality are and will remain the exclusive property of Diet Clinik and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Diet Clinik.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Limitation of Liability</h2>
                <p>In no event shall Diet Clinik, nor its directors, employees, vendors, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. Changes to Terms</h2>
                <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">7. Contact Us</h2>
                <p>If you have any questions about these Terms, please contact us.</p>
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
