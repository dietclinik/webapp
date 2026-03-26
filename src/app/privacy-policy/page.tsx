
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

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header variant="dark" />
      <main className="flex-1">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl font-bold font-headline">Privacy Policy</CardTitle>
              <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
                <p>We collect information you provide directly to us when you register for an account, such as your name, email address, mobile number, and health-related details like age, gender, height, weight, and existing health conditions. This information is essential for creating your personalized diet plan.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">2. How We Use Your Information</h2>
                <div>
                    <p>The information we collect is used to:</p>
                    <ul className="list-disc pl-6 mt-2 space-y-1">
                        <li>Provide, maintain, and improve our services.</li>
                        <li>Create and deliver personalized diet and health plans.</li>
                        <li>Communicate with you, including sending service-related notifications and promotional materials.</li>
                        <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
                    </ul>
                </div>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">3. Information Sharing</h2>
                <p>We do not share your personal information with third parties except as described in this policy. We may share information with vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (e.g., payment processors). We will not sell your personal information to any third party.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Security</h2>
                <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction. We use secure servers and data encryption to protect your data.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">5. Your Rights</h2>
                <p>You have the right to access, update, or delete your personal information at any time by logging into your account and visiting your profile page. If you wish to delete your account permanently, please contact our support team.</p>
              </section>
              <section>
                <h2 className="text-2xl font-semibold text-foreground mb-4">6. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us.</p>
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
