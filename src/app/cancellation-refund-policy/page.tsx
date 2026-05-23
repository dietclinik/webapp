
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

export default function CancellationRefundPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl font-bold font-headline">Cancellation & Refund Policy</CardTitle>
              <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Cancellation Policy</h2>
                <p>You may cancel your subscription at any time by contacting our customer support team. However, please note that our services are digital and personalized, and work on your plan begins as soon as you subscribe. Therefore, cancellations are subject to the terms outlined in this policy.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. No Refund Policy</h2>
                <p>Due to the nature of our digital services and the immediate access to proprietary information and personalized plans, we have a strict no-refund policy. Once a subscription fee has been paid, it is non-refundable.</p>
                <p>We do not provide refunds or credits for any partial subscription periods or for any unused services. By purchasing a subscription, you acknowledge and agree that you will not be entitled to a refund for any reason.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. Exceptional Circumstances</h2>
                <p>In rare and exceptional circumstances, Diet Clinik may consider a partial or full refund at its sole discretion. Such cases will be reviewed on a case-by-case basis and a decision will be made based on the specific circumstances, such as a demonstrable error in our service delivery. A request for consideration under exceptional circumstances must be submitted to our support team with all relevant details and documentation.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. How to Request Cancellation</h2>
                <p>To cancel your subscription, please contact our customer support via the email address or contact form provided on our website. Please include your name, email address, and reason for cancellation in your request. Your access to the service will continue until the end of your current billing period, after which it will not be renewed.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Contact Us</h2>
                <p>If you have any questions about our Cancellation and Refund Policy, please contact us.</p>
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
          <p className="text-sm text-muted-foreground">App Developed By <a href="https://voryntotechnologies.com" target="_blank" rel="noopener noreferrer" className="text-primary no-underline">Vorynto Pvt. Ltd.</a></p>
        </nav>
      </footer>
    </div>
  );
}
