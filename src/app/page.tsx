

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { useState, useEffect } from "react";
import Image from "next/image";
import { FeatureIcon } from "@/components/feature-icon";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-settings";
import { CheckCircle } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  price: number;
  features?: string[];
  status: 'Active' | 'Archived';
  showOnFrontend?: boolean;
  durationMonths?: number;
  durationDays?: number;
  tag?: string;
  displayOrder?: number;
  planFor?: 'customer' | 'vendor' | 'vendor_customer' | 'corporate';
};

type HomepageSettings = {
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl: string;
  featuresSectionVisible: boolean;
  features: { icon: string; title: string; description: string; }[];
  ctaHeadline: string;
  ctaSubheadline: string;
};

const initialHomepageSettings: HomepageSettings = {
  heroHeadline: "Achieve Your Health Goals with Us",
  heroSubheadline: "Personalized diet plans and expert guidance to help you lead a healthier life.",
  heroImageUrl: "https://placehold.co/1920x1080.png",
  featuresSectionVisible: true,
  features: [
    { icon: "HeartPulse", title: "Personalized Plans", description: "Get diet plans tailored to your specific needs and goals." },
    { icon: "Users", title: "Expert Guidance", description: "Our team of experts is here to support you every step of the way." },
    { icon: "LineChart", title: "Track Your Progress", description: "Monitor your progress and stay motivated with our tools." }
  ],
  ctaHeadline: "Ready to Start Your Journey?",
  ctaSubheadline: "Sign up today and take the first step towards a healthier, happier you. Our team is here to support you every step of the way."
};

const policyLinks = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/pricing-policy", label: "Pricing Policy" },
  { href: "/cancellation-refund-policy", label: "Cancellation & Refund Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/contact", label: "Contact Us" },
];

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [offsetY, setOffsetY] = useState(0);
  const { db } = useFirebase();
  const { settings, loading: settingsLoading } = useSettings();

  const homepageSettings = settings?.homepageSettings || initialHomepageSettings;
  const heroImageUrl = homepageSettings.heroImageUrl || initialHomepageSettings.heroImageUrl;

  const handleScroll = () => setOffsetY(window.pageYOffset);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!db) return;

    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const plansCollectionRef = collection(db, "subscriptionPlans");
        const q = query(plansCollectionRef, where("status", "==", "Active"), where("showOnFrontend", "==", true));
        const data = await getDocs(q);

        const activePlans = data.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as Plan))
          .filter(plan => plan.planFor !== 'vendor' && plan.planFor !== 'vendor_customer' && plan.planFor !== 'corporate');

        activePlans.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

        setPlans(activePlans);
      } catch (error) {
        console.error("Error fetching subscription plans:", error);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [db]);

  const loading = settingsLoading || loadingPlans;

  const formatDuration = (months?: number, days?: number) => {
    const parts = [];
    if (months && months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days && days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        <section className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden flex items-center justify-center">
          {heroImageUrl && (
            <>
              <div
                className="absolute inset-0 z-0"
                style={{ transform: `translateY(${offsetY * 0.4}px)` }}
              >
                <Image
                  src={heroImageUrl}
                  alt="Hero background"
                  fill
                  objectFit="cover"
                  priority
                  data-ai-hint="diet food"
                />
              </div>
              <div className="absolute inset-0 gradient-hero z-10" />
            </>
          )}
          <div className="container px-4 md:px-6 relative z-20 text-center flex flex-col items-center">
            <div className="space-y-6 animate-fade-in-up">
              <h1 className="text-3xl font-bold tracking-wide text-white sm:text-4xl md:text-5xl lg:text-6xl font-headline drop-shadow-lg">
                {homepageSettings.heroHeadline}
              </h1>
              <p className="mx-auto max-w-[700px] text-white/90 md:text-xl lg:text-2xl drop-shadow-md animate-fade-in-up delay-200">
                {homepageSettings.heroSubheadline}
              </p>
            </div>
          </div>
        </section>

        <section id="plans" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6">
            {loading ? (
              <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                  <Card key={index} className="flex flex-col">
                    <CardHeader className="items-center text-center pb-2">
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col items-center">
                      <Skeleton className="h-10 w-1/2 mb-4" />
                      <Skeleton className="h-6 w-1/4 mb-4" />
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : plans.length > 0 ? (
              <div className="mx-auto grid max-w-5xl items-stretch gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
                {plans.map((plan, index) => (
                  <Card key={plan.id} className={`flex flex-col hover-lift transition-all duration-300 animate-fade-in-up delay-${index * 100} ${plan.tag ? 'border-2 border-primary shadow-xl relative overflow-hidden' : 'border shadow-md'}`}>
                    {plan.tag && (
                      <div className="gradient-accent text-white text-sm font-semibold text-center py-2 rounded-t-lg relative overflow-hidden">
                        <span className="relative z-10">{plan.tag}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      </div>
                    )}
                    <CardHeader className="items-center text-center pb-2">
                      <CardTitle className="text-xl leading-tight">{plan.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="flex justify-center items-baseline my-4">
                        <span className="text-5xl font-bold gradient-text">₹{plan.price}</span>
                      </div>
                      <div className="text-center mb-4">
                        <Badge className="text-sm gradient-wellness text-white border-0 shadow-md">
                          For {formatDuration(plan.durationMonths, plan.durationDays)}
                        </Badge>
                      </div>
                      <ul className="text-muted-foreground text-sm space-y-3 flex-1 mt-4">
                        {plan.features?.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 animate-fade-in delay-${(i + 1) * 100}">
                            <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter className="pt-4">
                      <Link href={`/register/${plan.id}`} className="w-full">
                        <Button className={`w-full transition-all duration-300 ${plan.tag ? 'gradient-accent text-white hover:shadow-lg hover:scale-105' : 'hover:shadow-md'}`}>
                          Choose Plan
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Pricing plans are not available at the moment. Please check back later.</p>
              </div>
            )}
          </div>
        </section>

        {homepageSettings.featuresSectionVisible && (
          <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-muted/20 to-background">
            <div className="container mx-auto px-4 md:px-6">
              <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in-up">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline gradient-text">Why Choose Us?</h2>
                  <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    We provide the tools and support you need to succeed on your health journey.
                  </p>
                </div>
              </div>
              <div className="grid mx-auto max-w-5xl items-center gap-8 py-12 lg:grid-cols-3 lg:gap-12">
                {homepageSettings.features.map((feature: any, index: number) => (
                  <div key={index} className={`flex flex-col items-center text-center gap-4 p-8 rounded-2xl bg-card hover-lift shadow-md border animate-fade-in-up delay-${index * 100}`}>
                    <div className="gradient-wellness p-5 rounded-full shadow-lg animate-float" style={{ animationDelay: `${index * 0.2}s` }}>
                      <FeatureIcon name={feature.icon} className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="w-full py-12 md:py-24 lg:py-32 relative overflow-hidden">
          <div className="absolute inset-0 gradient-wellness opacity-5" />
          <div className="container mx-auto px-4 md:px-6 flex flex-col items-center justify-center gap-6 text-center relative z-10">
            <div className="space-y-4 animate-fade-in-up">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl font-headline">{homepageSettings.ctaHeadline}</h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                {homepageSettings.ctaSubheadline}
              </p>
            </div>
            <div className="w-full max-w-sm flex justify-center animate-fade-in-up delay-200">
              <Link href="/#plans">
                <Button className="gradient-accent text-white px-8 py-6 text-lg font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300 animate-glow">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </section>
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
