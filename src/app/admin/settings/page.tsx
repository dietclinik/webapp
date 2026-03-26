
"use client";

import React, { useState, useEffect, useCallback, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paintbrush, Palette, Type, Droplets, Home, Trash2, Sun, Moon, PlusCircle, Settings2, GripVertical, ShoppingCart, Info, UserPlus, Lock, Ruler, Activity, Flame, Mail, Briefcase, User, BookCopy, MessageSquare, Calculator, FileQuestion } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFirebase } from "@/components/firebase-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  sidebarBackground: string;
  sidebarForeground: string;
};

type ThemeSettings = {
  appName: string;
  logoColor: string;
  logoImage: string;
  logoIconSize: number;
  light: ThemeColors;
  dark: ThemeColors;
  fontFamily: string;
  fontSize: number;
  headingScale: number;
  sidebarIconSize: number;
  sidebarFontSize: number;
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

type ContactPageSettings = {
    email: string;
    phone: string;
    address: string;
    googleMapsUrl?: string;
};

type PaymentSettings = {
    razorpayEnabled: boolean;
};

type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'switch';
  required: boolean;
  placeholder?: string;
  stepId?: 'personalDetails' | 'bodyMeasurements' | 'assignPlan' | 'registerPersonal' | 'registerBody';
};

type CustomFieldsSettings = {
  customers: CustomField[];
  subscriptionPlans: CustomField[];
  dietPlans: CustomField[];
  staff: CustomField[];
  measurements: CustomField[];
};

type PageAccessRule = {
    pagePath: string;
    allowedPlanType: 'any' | 'self' | 'dietician';
    minTier: string;
    message: string;
};

type PageAccessSettings = {
    customerRules: PageAccessRule[];
    partnerRules: PageAccessRule[];
};

type ActivitySettings = {
    activities: { id: string; name: string; iconUrl?: string }[];
    durations: { id: string; value: string }[];
    intensityLevels: { id: string; name: string }[];
};

type MessagingTemplate = {
    templateName: string;
    variables?: { [key: string]: string };
};

type MessagingSettings = {
    welcome?: MessagingTemplate;
    renewalReminder?: MessagingTemplate;
    renewalSuccess?: MessagingTemplate;
    paymentFailed?: MessagingTemplate;
    dietAssigned?: MessagingTemplate;
};

const initialThemeSettings: ThemeSettings = {
  appName: "Diet Clinik",
  logoColor: "147 82% 33%",
  logoImage: "",
  logoIconSize: 40,
  light: {
    background: "40 33% 96%",
    foreground: "240 10% 3.9%",
    primary: "147 82% 33%",
    primaryForeground: "60 96% 96%",
    accent: "25 76% 47%",
    accentForeground: "0 0% 100%",
    sidebarBackground: "40 33% 96%",
    sidebarForeground: "240 10% 3.9%",
  },
  dark: {
    background: "222 47% 11%",
    foreground: "210 40% 98%",
    primary: "147 70% 45%",
    primaryForeground: "147 82% 95%",
    accent: "25 70% 55%",
    accentForeground: "210 40% 98%",
    sidebarBackground: "222 47% 11%",
    sidebarForeground: "210 40% 98%",
  },
  fontFamily: "Inter",
  fontSize: 16,
  headingScale: 1.2,
  sidebarIconSize: 24,
  sidebarFontSize: 16,
};

const initialHomepageSettings: HomepageSettings = {
    heroHeadline: "Achieve Your Health Goals with Us",
    heroSubheadline: "Personalized diet plans and expert guidance to help you lead a healthier life.",
    heroImageUrl: "",
    featuresSectionVisible: true,
    features: [
        { icon: "HeartPulse", title: "Personalized Plans", description: "Get diet plans tailored to your specific needs and goals." },
        { icon: "Users", title: "Expert Guidance", description: "Our team of experts is here to support you every step of the way." },
        { icon: "LineChart", title: "Track Your Progress", description: "Monitor your progress and stay motivated with our tools." }
    ],
    ctaHeadline: "Ready to Start Your Journey?",
    ctaSubheadline: "Sign up today and take the first step towards a healthier, happier you. Our team is here to support you every step of the way."
};

const initialContactPageSettings: ContactPageSettings = {
    email: "support@dietclinik.com",
    phone: "+91 12345 67890",
    address: "123 Health St, Wellness City, 456001",
    googleMapsUrl: ""
};

const initialPaymentSettings: PaymentSettings = {
    razorpayEnabled: true,
};

const initialCustomFieldsSettings: CustomFieldsSettings = {
    customers: [],
    subscriptionPlans: [],
    dietPlans: [],
    staff: [],
    measurements: [],
};

const customerDashboardPages = [
    { path: "/dashboard/overview", name: "Dashboard Overview" },
    { path: "/dashboard/self-diet-plan", name: "Self Diet Plan" },
    { path: "/dashboard/dietician-diet-plan", name: "Dietician Diet Plan" },
    { path: "/dashboard/progress", name: "Monthly Progress" },
    { path: "/dashboard/daily-weight-tracking", name: "Weight Tracking" },
    { path: "/dashboard/activity-tracker", name: "Activity Tracker" },
    { path: "/dashboard/meetings", name: "My Meetings" },
    { path: "/dashboard/support", name: "Help & Support" },
  ];

const partnerDashboardPages = [
    { path: "/partner/dashboard", name: "Partner Dashboard" },
    { path: "/partner/customers", name: "My Customers" },
    { path: "/partner/diet-plans", name: "Diet Plans" },
    { path: "/partner/earnings", name: "Earnings" },
    { path: "/partner/meetings", name: "My Meetings" },
    { path: "/partner/calculator", name: "Calculator" },
    { path: "/partner/enquiries", name: "Enquiries" },
];

const initialPageAccessSettings: PageAccessSettings = {
    customerRules: customerDashboardPages.map(page => ({
        pagePath: page.path,
        allowedPlanType: 'any',
        minTier: 'Basic',
        message: `Upgrade your plan to access the ${page.name} feature.`
    })),
    partnerRules: partnerDashboardPages.map(page => {
        const isCommonPage = page.path === '/partner/calculator' || page.path === '/partner/enquiries';
        return {
            pagePath: page.path,
            allowedPlanType: 'any',
            minTier: isCommonPage ? 'Freemium' : 'Basic',
            message: `Upgrade your partner plan to access the ${page.name} feature.`
        }
    })
};

const initialActivitySettings: ActivitySettings = {
    activities: [],
    durations: [],
    intensityLevels: [],
};

const initialMessagingSettings: MessagingSettings = {
    welcome: { templateName: '' },
    renewalReminder: { templateName: '' },
    renewalSuccess: { templateName: '' },
    paymentFailed: { templateName: '' },
    dietAssigned: { templateName: '' },
};

const fontOptions = ["Inter", "Poppins", "Roboto", "Lato"];

function hslToHex(hsl: string): string {
  if (!hsl || typeof hsl !== 'string') {
    return '#000000';
  }
  let [h, s, l] = hsl.split(" ").map(val => parseFloat(val.replace('%', '')));
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c/2,
      r = 0,
      g = 0,
      b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToHsl(hex: string): string {
    if (!hex) return '0 0% 0%';
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length == 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    let cmin = Math.min(r,g,b),
        cmax = Math.max(r,g,b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}


type CustomFieldEditorProps = {
  area: keyof CustomFieldsSettings;
  fields: CustomField[];
  title: string;
  handleCustomFieldChange: (area: keyof CustomFieldsSettings, index: number, field: keyof CustomField, value: string | boolean) => void;
  handleRemoveCustomField: (area: keyof CustomFieldsSettings, index: number) => void;
};

const CustomFieldEditor = React.memo(function CustomFieldEditor({ area, fields, title, handleCustomFieldChange, handleRemoveCustomField }: CustomFieldEditorProps) {
  return (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Manage custom fields for the {title.toLowerCase()} section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {fields.length > 0 ? fields.map((field, index) => (
                 <Card key={field.id} className="p-4 space-y-4">
                     <div className="flex items-start gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-move"/>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor={`label-${field.id}`}>Field Label</Label>
                                <Input id={`label-${field.id}`} value={field.label} onChange={(e) => handleCustomFieldChange(area, index, 'label', e.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor={`type-${field.id}`}>Field Type</Label>
                                <Select value={field.type} onValueChange={(value) => handleCustomFieldChange(area, index, 'type', value)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="textarea">Textarea</SelectItem>
                                        <SelectItem value="switch">Switch (Toggle)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                           {area === 'customers' && (
                                <div>
                                    <Label htmlFor={`step-${field.id}`}>Form Step</Label>
                                    <Select value={field.stepId} onValueChange={(value) => handleCustomFieldChange(area, index, 'stepId', value)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Admin Form</SelectLabel>
                                                <SelectItem value="personalDetails">Personal Details</SelectItem>
                                                <SelectItem value="bodyMeasurements">Body Measurements</SelectItem>
                                                <SelectItem value="assignPlan">Assign Plan</SelectItem>
                                            </SelectGroup>
                                            <SelectGroup>
                                                <SelectLabel>Registration Form</SelectLabel>
                                                 <SelectItem value="registerPersonal">Personal Details</SelectItem>
                                                 <SelectItem value="registerBody">Body Measurements</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-4 pl-4">
                           <div className="flex items-center space-x-2 pt-6">
                                <Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={(checked) => handleCustomFieldChange(area, index, 'required', checked)} />
                                <Label htmlFor={`required-${field.id}`}>Required</Label>
                            </div>
                             <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveCustomField(area, index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )) : <p className="text-sm text-muted-foreground text-center p-4">No custom fields for {title}.</p>}
        </CardContent>
    </Card>
  );
});
CustomFieldEditor.displayName = 'CustomFieldEditor';

const availableTemplateVariables: { [key: string]: { label: string; description: string } } = {
  customerName: { label: 'Customer Name', description: "The customer's first name." },
  planName: { label: 'Plan Name', description: 'The name of the subscription plan.' },
  expiryDate: { label: 'Expiry Date', description: 'The subscription expiry date.' },
};

export default function SettingsPage() {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(initialThemeSettings);
  const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(initialHomepageSettings);
  const [contactPageSettings, setContactPageSettings] = useState<ContactPageSettings>(initialContactPageSettings);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(initialPaymentSettings);
  const [customFields, setCustomFields] = useState<CustomFieldsSettings>(initialCustomFieldsSettings);
  const [pageAccess, setPageAccess] = useState<PageAccessSettings>(initialPageAccessSettings);
  const [activitySettings, setActivitySettings] = useState<ActivitySettings>(initialActivitySettings);
  const [messagingSettings, setMessagingSettings] = useState<MessagingSettings>(initialMessagingSettings);
  const [newActivity, setNewActivity] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newIntensity, setNewIntensity] = useState('');
  const [newFieldArea, setNewFieldArea] = useState<keyof CustomFieldsSettings>('customers');
  const [newCustomerFieldStep, setNewCustomerFieldStep] = useState<'personalDetails' | 'bodyMeasurements' | 'assignPlan' | 'registerPersonal' | 'registerBody'>('personalDetails');
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);

  const { toast } = useToast();
  const { db } = useFirebase();
  
  const loadSettings = useCallback(async () => {
    if (!db) return;
    const settingsDocRef = doc(db, "settings", "global");
    try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.themeSettings) {
                const mergedThemeSettings = {
                    ...initialThemeSettings,
                    ...data.themeSettings,
                    light: { ...initialThemeSettings.light, ...data.themeSettings.light },
                    dark: { ...initialThemeSettings.dark, ...data.themeSettings.dark },
                };
                setThemeSettings(mergedThemeSettings);
            }
            if (data.homepageSettings) {
                setHomepageSettings(prev => ({...prev, ...data.homepageSettings}));
            }
             if (data.contactPageSettings) {
                setContactPageSettings(prev => ({...prev, ...data.contactPageSettings}));
            }
             if (data.paymentSettings) {
                setPaymentSettings(prev => ({...prev, ...data.paymentSettings}));
            }
            if (data.customFields) {
                setCustomFields(prev => ({...initialCustomFieldsSettings, ...data.customFields}));
            }
            if (data.activitySettings) {
                setActivitySettings(prev => ({ ...initialActivitySettings, ...data.activitySettings }));
            }
            if (data.messagingSettings) {
                setMessagingSettings(prev => ({ ...initialMessagingSettings, ...data.messagingSettings }));
            }
             if (data.pageAccess) {
                const existingCustomerRules = data.pageAccess.customerRules || [];
                const existingCustomerPaths = existingCustomerRules.map((r: any) => r.pagePath);
                const newCustomerRules = customerDashboardPages
                    .filter(p => !existingCustomerPaths.includes(p.path))
                    .map(p => ({
                        pagePath: p.path,
                        allowedPlanType: 'any',
                        minTier: 'Basic',
                        message: `Upgrade your plan to access the ${p.name} feature.`
                    }));

                const existingPartnerRules = data.pageAccess.partnerRules || [];
                const existingPartnerPaths = existingPartnerRules.map((r: any) => r.pagePath);
                const newPartnerRules = partnerDashboardPages
                    .filter(p => !existingPartnerPaths.includes(p.path))
                    .map(p => ({
                        pagePath: p.path,
                        allowedPlanType: 'any',
                        minTier: 'Freemium',
                        message: `Upgrade your partner plan to access the ${p.name} feature.`
                    }));
                
                setPageAccess({ 
                    customerRules: [...existingCustomerRules, ...newCustomerRules],
                    partnerRules: [...existingPartnerRules, ...newPartnerRules]
                });
             } else {
                 setPageAccess(initialPageAccessSettings);
             }
        }
    } catch (error) {
        console.error("Error loading settings from Firestore:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not load settings." });
    }
  }, [db, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleThemeColorChange = (mode: 'light' | 'dark', name: keyof ThemeColors, value: string) => {
    const hslValue = hexToHsl(value);
    setThemeSettings(prev => ({ 
        ...prev, 
        [mode]: {
            ...prev[mode],
            [name]: hslValue
        }
    }));
  };
  
  const handleThemeSliderChange = (name: keyof ThemeSettings) => (value: number[]) => {
    setThemeSettings(prev => ({...prev, [name]: value[0]}));
  };
  
   const handleThemeInputChange = (name: keyof ThemeSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setThemeSettings(prev => ({ ...prev, [name]: value }));
  };
  
   const handleLogoColorChange = (value: string) => {
    const hslValue = hexToHsl(value);
    setThemeSettings(prev => ({ ...prev, logoColor: hslValue }));
  };

  const handleThemeFontChange = (value: string) => {
    setThemeSettings(prev => ({ ...prev, fontFamily: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setThemeSettings(prev => ({...prev, logoImage: reader.result as string}));
      }
      reader.readAsDataURL(file);
    }
  };

  const handleHomepageInputChange = (name: keyof HomepageSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setHomepageSettings(prev => ({ ...prev, [name]: e.target.value }));
  };
  
  const handleContactPageInputChange = (name: keyof ContactPageSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContactPageSettings(prev => ({ ...prev, [name]: e.target.value }));
  };

  const handleMessagingInputChange = (templateKey: keyof MessagingSettings, field: 'templateName' | 'variable', varNumber?: number) => (value: string) => {
    setMessagingSettings(prev => {
        const newSettings = { ...prev };
        const template = newSettings[templateKey] || { templateName: '', variables: {} };
        if (field === 'templateName') {
            template.templateName = value;
        } else if (field === 'variable' && varNumber) {
            template.variables = { ...template.variables, [`var${varNumber}`]: value };
        }
        newSettings[templateKey] = template;
        return newSettings;
    });
  };

  const handleFeatureChange = (index: number, field: 'icon' | 'title' | 'description') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newFeatures = [...homepageSettings.features];
    newFeatures[index][field] = e.target.value;
    setHomepageSettings(prev => ({ ...prev, features: newFeatures }));
  };

  const handleAddFeature = () => {
    setHomepageSettings(prev => ({
      ...prev,
      features: [...prev.features, { icon: "Sparkles", title: "New Feature", description: "Describe the new feature." }]
    }));
  };
  
  const handleRemoveFeature = (index: number) => {
    const newFeatures = homepageSettings.features.filter((_, i) => i !== index);
    setHomepageSettings(prev => ({ ...prev, features: newFeatures }));
  };

  const handleCustomFieldChange = useCallback((area: keyof CustomFieldsSettings, index: number, field: keyof CustomField, value: string | boolean) => {
    setCustomFields(prev => {
        const newFields = [...prev[area]];
        newFields[index] = {...newFields[index], [field]: value};
        return {
            ...prev,
            [area]: newFields
        };
    });
  }, []);

  const handleAddNewField = () => {
    const newId = `custom_${newFieldArea}_${Date.now()}`;
    const newField: CustomField = { id: newId, label: "New Field", type: "text", required: false, placeholder: "Enter value..." };
    
    if (newFieldArea === 'customers') {
      newField.stepId = newCustomerFieldStep;
    }

    setCustomFields(prev => ({
      ...prev,
      [newFieldArea]: [...(prev[newFieldArea] || []), newField]
    }));
  };

  const handleRemoveCustomField = useCallback((area: keyof CustomFieldsSettings, index: number) => {
    setCustomFields(prev => ({
        ...prev,
        [area]: prev[area].filter((_, i) => i !== index)
    }));
  }, []);

  const handlePageAccessChange = (ruleType: 'customerRules' | 'partnerRules', index: number, field: keyof PageAccessRule, value: string) => {
    setPageAccess(prev => {
        const newRules = [...prev[ruleType]];
        const ruleToUpdate = { ...newRules[index], [field]: value };
        newRules[index] = ruleToUpdate;
        return { ...prev, [ruleType]: newRules };
    });
};
  
  const handleAddActivity = () => {
    if (!newActivity.trim()) return;
    setActivitySettings(prev => ({
      ...prev,
      activities: [...(prev.activities || []), { id: `activity_${Date.now()}`, name: newActivity, iconUrl: '' }]
    }));
    setNewActivity('');
  };

  const handleRemoveActivity = (id: string) => {
    setActivitySettings(prev => ({ ...prev, activities: prev.activities.filter(a => a.id !== id) }));
  };
  
   const handleActivityIconChange = (id: string, file: File | null) => {
    if (!file) {
      setActivitySettings(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === id ? { ...a, iconUrl: '' } : a)
      }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setActivitySettings(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === id ? { ...a, iconUrl: dataUrl } : a)
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedActivityId(id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (draggedActivityId === null) return;

    setActivitySettings(prev => {
      const activities = [...prev.activities];
      const draggedIndex = activities.findIndex(a => a.id === draggedActivityId);
      const targetIndex = activities.findIndex(a => a.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const [draggedItem] = activities.splice(draggedIndex, 1);
      activities.splice(targetIndex, 0, draggedItem);
      
      return { ...prev, activities };
    });
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
  };

  const handleAddDuration = () => {
    if (!newDuration.trim()) return;
    setActivitySettings(prev => ({
      ...prev,
      durations: [...(prev.durations || []), { id: `duration_${Date.now()}`, value: newDuration }]
    }));
    setNewDuration('');
  };

  const handleRemoveDuration = (id: string) => {
    setActivitySettings(prev => ({ ...prev, durations: prev.durations.filter(d => d.id !== id) }));
  };

  const handleAddIntensity = () => {
    if (!newIntensity.trim()) return;
    setActivitySettings(prev => ({
      ...prev,
      intensityLevels: [...(prev.intensityLevels || []), { id: `intensity_${Date.now()}`, name: newIntensity }]
    }));
    setNewIntensity('');
  };

  const handleRemoveIntensity = (id: string) => {
    setActivitySettings(prev => ({ ...prev, intensityLevels: prev.intensityLevels.filter(i => i.id !== id) }));
  };


  const applySettings = useCallback(async () => {
    if (!db) return;
    const settingsDocRef = doc(db, "settings", "global");
    const allSettings = { themeSettings, homepageSettings, paymentSettings, customFields, pageAccess, activitySettings, contactPageSettings, messagingSettings };
    try {
        await setDoc(settingsDocRef, allSettings, { merge: true });
        localStorage.setItem("globalSettings", JSON.stringify(allSettings));
        
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: allSettings }));
        
        toast({
            title: "Settings Updated",
            description: "Your new settings have been saved and applied.",
        });
    } catch (error) {
        console.error("Error saving settings to Firestore:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not save settings." });
    }
  }, [themeSettings, homepageSettings, paymentSettings, customFields, pageAccess, activitySettings, contactPageSettings, messagingSettings, toast, db]);

  const resetToDefaults = async () => {
    if (!db) return;
    const settingsDocRef = doc(db, "settings", "global");
    const defaultSettings = { 
        themeSettings: initialThemeSettings, 
        homepageSettings: initialHomepageSettings,
        contactPageSettings: initialContactPageSettings,
        paymentSettings: initialPaymentSettings,
        customFields: initialCustomFieldsSettings,
        pageAccess: initialPageAccessSettings,
        activitySettings: initialActivitySettings,
        messagingSettings: initialMessagingSettings,
    };
    try {
        await setDoc(settingsDocRef, defaultSettings, { merge: true });
        setThemeSettings(initialThemeSettings);
        setHomepageSettings(initialHomepageSettings);
        setContactPageSettings(initialContactPageSettings);
        setPaymentSettings(initialPaymentSettings);
        setCustomFields(initialCustomFieldsSettings);
        setPageAccess(initialPageAccessSettings);
        setActivitySettings(initialActivitySettings);
        setMessagingSettings(initialMessagingSettings);
        localStorage.removeItem("globalSettings");
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: defaultSettings }));
        toast({ title: "Settings Reset", description: "Settings have been reset to defaults. Reloading..." });
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        console.error("Error resetting settings:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not reset settings." });
    }
  };

  const ColorInput = ({ label, name, value, mode }: { label: string; name: keyof ThemeColors; value: string, mode: 'light' | 'dark' }) => (
    <div className="space-y-2">
      <Label htmlFor={`${mode}-${name}`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input 
            id={`${mode}-${name}-picker`}
            type="color" 
            value={hslToHex(value)} 
            onChange={e => handleThemeColorChange(mode, name, e.target.value)} 
            className="p-1 h-10 w-14"
        />
        <Input 
            id={`${mode}-${name}-text`}
            type="text" 
            value={hslToHex(value)} 
            onChange={e => handleThemeColorChange(mode, name, e.target.value)} 
            className="flex-1"
        />
      </div>
    </div>
  );
  
  const SizeSlider = ({ label, name, value, min, max, step, unit }: { label: string; name: keyof ThemeSettings; value: number; min:number; max:number; step:number; unit:string; }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor={name as string}>{label}</Label>
        <span className="text-sm text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider
        id={name as string}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={handleThemeSliderChange(name)}
      />
    </div>
  );

  const ColorSchemeEditor = ({ mode }: { mode: 'light' | 'dark' }) => (
     <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle>Global Colors</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorInput label="Background Color" name="background" value={themeSettings[mode].background} mode={mode} />
                <ColorInput label="Foreground Color (Text)" name="foreground" value={themeSettings[mode].foreground} mode={mode} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Primary/Button Colors</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorInput label="Primary Color" name="primary" value={themeSettings[mode].primary} mode={mode} />
                <ColorInput label="Primary Foreground (Text)" name="primaryForeground" value={themeSettings[mode].primaryForeground} mode={mode} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Accent Colors</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorInput label="Accent Color" name="accent" value={themeSettings[mode].accent} mode={mode} />
                <ColorInput label="Accent Foreground (Text)" name="accentForeground" value={themeSettings[mode].accentForeground} mode={mode} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Sidebar Colors</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorInput label="Sidebar Background" name="sidebarBackground" value={themeSettings[mode].sidebarBackground} mode={mode} />
                <ColorInput label="Sidebar Foreground (Text)" name="sidebarForeground" value={themeSettings[mode].sidebarForeground} mode={mode} />
            </CardContent>
        </Card>
    </div>
  );

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline">Settings</h1>
        <p className="text-muted-foreground">Customize the look, feel, and content of your application.</p>
      </div>

        <Tabs defaultValue="branding" className="flex flex-col md:flex-row gap-8">
            <TabsList className="flex md:flex-col h-full bg-transparent p-0 border-r md:w-48">
                <TabsTrigger value="branding" className="w-full justify-start text-base p-3"><Paintbrush className="mr-2 h-5 w-5"/>Branding</TabsTrigger>
                <TabsTrigger value="theme" className="w-full justify-start text-base p-3"><Palette className="mr-2 h-5 w-5"/>Theme</TabsTrigger>
                <TabsTrigger value="homepage" className="w-full justify-start text-base p-3"><Home className="mr-2 h-5 w-5"/>Homepage</TabsTrigger>
                <TabsTrigger value="contact" className="w-full justify-start text-base p-3"><Mail className="mr-2 h-5 w-5"/>Contact Page</TabsTrigger>
                <TabsTrigger value="messaging" className="w-full justify-start text-base p-3"><MessageSquare className="mr-2 h-5 w-5"/>Messaging</TabsTrigger>
                <TabsTrigger value="payments" className="w-full justify-start text-base p-3"><ShoppingCart className="mr-2 h-5 w-5"/>Payments</TabsTrigger>
                <TabsTrigger value="customFields" className="w-full justify-start text-base p-3"><Settings2 className="mr-2 h-5 w-5"/>Custom Fields</TabsTrigger>
                <TabsTrigger value="pageAccess" className="w-full justify-start text-base p-3"><Lock className="mr-2 h-5 w-5"/>Page Access</TabsTrigger>
                <TabsTrigger value="activities" className="w-full justify-start text-base p-3"><Activity className="mr-2 h-5 w-5"/>Activities</TabsTrigger>
            </TabsList>
            <div className="flex-1">
                <TabsContent value="branding">
                    <Card>
                        <CardHeader>
                        <CardTitle>Branding &amp; Fonts</CardTitle>
                        <CardDescription>Customize your app's branding, logo, and typography.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="appName">App Name</Label>
                                    <Input 
                                        id="appName"
                                        type="text"
                                        value={themeSettings.appName}
                                        onChange={handleThemeInputChange("appName")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="logoColor">Logo Icon Color</Label>
                                     <div className="flex items-center gap-2">
                                        <Input 
                                            id="logoColor-picker"
                                            type="color" 
                                            value={hslToHex(themeSettings.logoColor)} 
                                            onChange={e => handleLogoColorChange(e.target.value)} 
                                            className="p-1 h-10 w-14"
                                        />
                                        <Input 
                                            id="logoColor-text"
                                            type="text" 
                                            value={hslToHex(themeSettings.logoColor)} 
                                            onChange={e => handleLogoColorChange(e.target.value)} 
                                            className="flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                             <div className="space-y-2">
                                <Label htmlFor="logoImage">Upload Logo</Label>
                                <Input 
                                    id="logoImage"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoChange}
                                />
                                {themeSettings.logoImage && (
                                <div className="mt-4 flex flex-col items-start gap-4">
                                    <span className="text-sm font-medium">Logo Preview:</span>
                                    <Image src={themeSettings.logoImage} alt="Logo preview" width={100} height={100} className="rounded-md border p-2" />
                                    <Button variant="outline" size="sm" onClick={() => setThemeSettings(prev => ({...prev, logoImage: ''}))}>
                                        Remove Logo
                                    </Button>
                                </div>
                                )}
                            </div>
                            <hr/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <SizeSlider label="Logo Size" name="logoIconSize" value={themeSettings.logoIconSize} min={20} max={60} step={1} unit="px" />
                                <div className="space-y-2">
                                    <Label htmlFor="fontFamily">Font Family</Label>
                                    <Select value={themeSettings.fontFamily} onValueChange={handleThemeFontChange}>
                                        <SelectTrigger id="fontFamily">
                                            <SelectValue placeholder="Select a font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fontOptions.map(font => (
                                                <SelectItem key={font} value={font}>{font}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <SizeSlider label="Base Font Size" name="fontSize" value={themeSettings.fontSize} min={12} max={20} step={1} unit="px" />
                                <SizeSlider label="Heading Scale" name="headingScale" value={themeSettings.headingScale} min={1.1} max={1.5} step={0.05} unit="x" />
                                <SizeSlider label="Sidebar Font Size" name="sidebarFontSize" value={themeSettings.sidebarFontSize} min={12} max={20} step={1} unit="px" />
                                <SizeSlider label="Sidebar Icon Size" name="sidebarIconSize" value={themeSettings.sidebarIconSize} min={16} max={40} step={1} unit="px" />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="theme">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center"><Droplets className="mr-2 h-5 w-5" /> Color Schemes</CardTitle>
                            <CardDescription>Adjust the color schemes for light and dark modes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="light">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="light"><Sun className="mr-2 h-4 w-4" /> Light Mode</TabsTrigger>
                                    <TabsTrigger value="dark"><Moon className="mr-2 h-4 w-4" /> Dark Mode</TabsTrigger>
                                </TabsList>
                                <TabsContent value="light" className="pt-6">
                                    <ColorSchemeEditor mode="light" />
                                </TabsContent>
                                <TabsContent value="dark" className="pt-6">
                                    <ColorSchemeEditor mode="dark" />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                     </Card>
                </TabsContent>
                 <TabsContent value="homepage">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Hero Section</CardTitle>
                                <CardDescription>Customize the main section of your homepage.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="heroHeadline">Headline</Label>
                                    <Input id="heroHeadline" value={homepageSettings.heroHeadline} onChange={handleHomepageInputChange('heroHeadline')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="heroSubheadline">Subheadline</Label>
                                    <Textarea id="heroSubheadline" value={homepageSettings.heroSubheadline} onChange={handleHomepageInputChange('heroSubheadline')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="heroImageUrl">Background Image URL</Label>
                                    <Input id="heroImageUrl" placeholder="https://placehold.co/1920x1080.png" value={homepageSettings.heroImageUrl} onChange={handleHomepageInputChange('heroImageUrl')} />
                                </div>
                                {homepageSettings.heroImageUrl && (
                                     <Image src={homepageSettings.heroImageUrl} alt="Hero preview" width={200} height={100} className="rounded-md border p-2 object-cover" />
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Features Section</CardTitle>
                                <CardDescription>Manage the features displayed on your homepage.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Switch id="featuresSectionVisible" checked={homepageSettings.featuresSectionVisible} onCheckedChange={(checked) => setHomepageSettings(prev => ({ ...prev, featuresSectionVisible: checked }))} />
                                    <Label htmlFor="featuresSectionVisible">Show Features Section</Label>
                                </div>
                                {homepageSettings.featuresSectionVisible && (
                                    <div className="space-y-4 pt-4">
                                        {homepageSettings.features.map((feature, index) => (
                                            <Card key={index} className="p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`feature-icon-${index}`}>Icon Name (from lucide-react)</Label>
                                                        <Input id={`feature-icon-${index}`} value={feature.icon} onChange={handleFeatureChange(index, 'icon')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`feature-title-${index}`}>Title</Label>
                                                        <Input id={`feature-title-${index}`} value={feature.title} onChange={handleFeatureChange(index, 'title')} />
                                                    </div>
                                                    <div className="space-y-2 md:col-span-2">
                                                        <Label htmlFor={`feature-desc-${index}`}>Description</Label>
                                                        <Textarea id={`feature-desc-${index}`} value={feature.description} onChange={handleFeatureChange(index, 'description')} />
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-destructive mt-2" onClick={() => handleRemoveFeature(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </Card>
                                        ))}
                                        <Button variant="outline" onClick={handleAddFeature}>Add Feature</Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Call to Action Section</CardTitle>
                                <CardDescription>Customize the final call to action section.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ctaHeadline">Headline</Label>
                                    <Input id="ctaHeadline" value={homepageSettings.ctaHeadline} onChange={handleHomepageInputChange('ctaHeadline')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ctaSubheadline">Subheadline</Label>
                                    <Textarea id="ctaSubheadline" value={homepageSettings.ctaSubheadline} onChange={handleHomepageInputChange('ctaSubheadline')} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="contact">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Details</CardTitle>
                            <CardDescription>Update the contact information displayed on the "Contact Us" page.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail">Contact Email</Label>
                                <Input id="contactEmail" type="email" value={contactPageSettings.email} onChange={handleContactPageInputChange('email')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                <Input id="contactPhone" type="tel" value={contactPageSettings.phone} onChange={handleContactPageInputChange('phone')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactAddress">Contact Address</Label>
                                <Textarea id="contactAddress" value={contactPageSettings.address} onChange={handleContactPageInputChange('address')} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="googleMapsUrl">Google Maps Embed URL</Label>
                                <Textarea id="googleMapsUrl" placeholder="Paste the full <iframe> code from Google Maps here" value={contactPageSettings.googleMapsUrl} onChange={handleContactPageInputChange('googleMapsUrl')} />
                                <p className="text-xs text-muted-foreground">Go to Google Maps, find your location, click "Share", then "Embed a map", and copy the full iframe code.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="messaging">
                    <Card>
                        <CardHeader>
                            <CardTitle>WhatsApp Templates</CardTitle>
                            <CardDescription>Manage your MSG91 WhatsApp template names and map variables.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(Object.keys(initialMessagingSettings) as Array<keyof MessagingSettings>).map(templateKey => (
                                <Card key={templateKey} className="p-4">
                                    <h4 className="font-semibold capitalize mb-2">{templateKey.replace(/([A-Z])/g, ' $1')}</h4>
                                    <div className="space-y-2">
                                        <Label>Template Name</Label>
                                        <Input
                                            value={messagingSettings[templateKey]?.templateName || ''}
                                            onChange={(e) => handleMessagingInputChange(templateKey, 'templateName')(e.target.value)}
                                            placeholder={`Name of the ${templateKey} template`}
                                        />
                                    </div>
                                    <div className="space-y-2 mt-4">
                                        <Label>Variable Mapping</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {[1, 2, 3, 4, 5].map(varNum => (
                                                <div key={varNum} className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-muted-foreground">{"{{" + varNum + "}}:"}</span>
                                                    <Select
                                                        value={messagingSettings[templateKey]?.variables?.[`var${varNum}`] || 'none'}
                                                        onValueChange={handleMessagingInputChange(templateKey, 'variable', varNum)}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Select Data Field" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                            {Object.entries(availableTemplateVariables).map(([key, { label }]) => (
                                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="payments">
                     <Card>
                        <CardHeader>
                            <CardTitle>Payment Gateway</CardTitle>
                            <CardDescription>Configure your payment gateway settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Configuration Notice</AlertTitle>
                                <AlertDescription>
                                    Your Razorpay keys should be set in your project's environment variables for security. Add the following to your `.env` file:
                                    <code className="block bg-muted p-2 rounded-md my-2 text-sm font-mono">
                                        NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id_here<br/>
                                        RAZORPAY_KEY_SECRET=your_key_secret_here
                                    </code>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                     </Card>
                </TabsContent>
                <TabsContent value="customFields">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add New Field</CardTitle>
                                <CardDescription>Create a new custom field for any section.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-end gap-4">
                                <div className="flex-1">
                                    <Label>Field Area</Label>
                                    <div className="flex gap-2">
                                        <Select value={newFieldArea} onValueChange={(v) => setNewFieldArea(v as any)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="customers">Customers</SelectItem>
                                                <SelectItem value="subscriptionPlans">Subscription Plans</SelectItem>
                                                <SelectItem value="dietPlans">Diet Plans</SelectItem>
                                                <SelectItem value="staff">Staff</SelectItem>
                                                <SelectItem value="measurements">Measurements</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {newFieldArea === 'customers' && (
                                            <Select value={newCustomerFieldStep} onValueChange={(v) => setNewCustomerFieldStep(v as any)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Admin Form</SelectLabel>
                                                        <SelectItem value="personalDetails">Personal Details</SelectItem>
                                                        <SelectItem value="bodyMeasurements">Body Measurements</SelectItem>
                                                        <SelectItem value="assignPlan">Assign Plan</SelectItem>
                                                    </SelectGroup>
                                                    <SelectGroup>
                                                        <SelectLabel>Registration Form</SelectLabel>
                                                         <SelectItem value="registerPersonal">Personal Details</SelectItem>
                                                         <SelectItem value="registerBody">Body Measurements</SelectItem>
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                                <Button onClick={handleAddNewField}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Field
                                </Button>
                            </CardContent>
                        </Card>
                        <CustomFieldEditor 
                            area="customers"
                            fields={customFields.customers}
                            title="Customer Fields"
                            handleCustomFieldChange={handleCustomFieldChange}
                            handleRemoveCustomField={handleRemoveCustomField}
                        />
                         <CustomFieldEditor 
                            area="staff"
                            fields={customFields.staff || []}
                            title="Staff Fields"
                            handleCustomFieldChange={handleCustomFieldChange}
                            handleRemoveCustomField={handleRemoveCustomField}
                        />
                        <CustomFieldEditor 
                            area="subscriptionPlans"
                            fields={customFields.subscriptionPlans}
                            title="Subscription Plan Fields"
                            handleCustomFieldChange={handleCustomFieldChange}
                            handleRemoveCustomField={handleRemoveCustomField}
                        />
                        <CustomFieldEditor 
                            area="dietPlans"
                            fields={customFields.dietPlans}
                            title="Diet Plan Fields"
                            handleCustomFieldChange={handleCustomFieldChange}
                            handleRemoveCustomField={handleRemoveCustomField}
                        />
                        <CustomFieldEditor 
                            area="measurements"
                            fields={customFields.measurements || []}
                            title="Measurement Fields"
                            handleCustomFieldChange={handleCustomFieldChange}
                            handleRemoveCustomField={handleRemoveCustomField}
                        />
                    </div>
                </TabsContent>
                <TabsContent value="pageAccess">
                    <Tabs defaultValue="customer">
                        <TabsList className="grid w-full grid-cols-2">
                             <TabsTrigger value="customer"><User className="mr-2 h-4 w-4"/>Customer Pages</TabsTrigger>
                             <TabsTrigger value="partner"><Briefcase className="mr-2 h-4 w-4"/>Partner Pages</TabsTrigger>
                        </TabsList>
                        <TabsContent value="customer" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Page Access</CardTitle>
                                    <CardDescription>Set the minimum subscription tier required to access specific customer dashboard pages.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {pageAccess.customerRules.map((rule, index) => {
                                        const pageName = customerDashboardPages.find(p => p.path === rule.pagePath)?.name || rule.pagePath;
                                        return (
                                        <Card key={index} className="p-4">
                                            <div className="grid gap-4">
                                                <h4 className="font-semibold">{pageName}</h4>
                                                <div>
                                                    <Label>Required Plan Type</Label>
                                                    <RadioGroup
                                                        value={rule.allowedPlanType || 'any'}
                                                        onValueChange={(value) => handlePageAccessChange('customerRules', index, 'allowedPlanType', value)}
                                                        className="flex space-x-4 pt-2"
                                                        >
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="any" id={`any-cust-${index}`} /><Label htmlFor={`any-cust-${index}`}>Any</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="self" id={`self-cust-${index}`} /><Label htmlFor={`self-cust-${index}`}>Self-Diet</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="dietician" id={`dietician-cust-${index}`} /><Label htmlFor={`dietician-cust-${index}`}>Dietician</Label></div>
                                                    </RadioGroup>
                                                </div>
                                                <div>
                                                    <Label htmlFor={`tier-cust-${index}`}>Minimum Tier</Label>
                                                    <Select value={rule.minTier} onValueChange={(value) => handlePageAccessChange('customerRules', index, 'minTier', value)}>
                                                        <SelectTrigger id={`tier-cust-${index}`}><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Basic">Basic</SelectItem>
                                                            <SelectItem value="Premium">Premium</SelectItem>
                                                            <SelectItem value="Pro">Pro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label htmlFor={`message-cust-${index}`}>Access Denied Message</Label>
                                                    <Textarea id={`message-cust-${index}`} value={rule.message} onChange={(e) => handlePageAccessChange('customerRules', index, 'message', e.target.value)} />
                                                </div>
                                            </div>
                                        </Card>
                                    )})}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="partner" className="mt-4">
                              <Card>
                                <CardHeader>
                                    <CardTitle>Partner Page Access</CardTitle>
                                    <CardDescription>Set the minimum subscription tier required to access specific partner portal pages.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {pageAccess.partnerRules.map((rule, index) => {
                                        const pageName = partnerDashboardPages.find(p => p.path === rule.pagePath)?.name || rule.pagePath;
                                        return (
                                        <Card key={index} className="p-4">
                                            <div className="grid gap-4">
                                                <h4 className="font-semibold">{pageName}</h4>
                                                <div>
                                                    <Label htmlFor={`tier-partner-${index}`}>Minimum Tier</Label>
                                                    <Select value={rule.minTier} onValueChange={(value) => handlePageAccessChange('partnerRules', index, 'minTier', value)}>
                                                        <SelectTrigger id={`tier-partner-${index}`}><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Freemium">Freemium (All Partners)</SelectItem>
                                                            <SelectItem value="Basic">Basic</SelectItem>
                                                            <SelectItem value="Premium">Premium</SelectItem>
                                                            <SelectItem value="Pro">Pro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label htmlFor={`message-partner-${index}`}>Access Denied Message</Label>
                                                    <Textarea id={`message-partner-${index}`} value={rule.message} onChange={(e) => handlePageAccessChange('partnerRules', index, 'message', e.target.value)} />
                                                </div>
                                            </div>
                                        </Card>
                                    )})}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
                <TabsContent value="activities">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity Types</CardTitle>
                                <CardDescription>Manage the list of available activities for customers to log.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="e.g., Running" 
                                        value={newActivity}
                                        onChange={(e) => setNewActivity(e.target.value)}
                                    />
                                    <Button onClick={handleAddActivity}><PlusCircle className="mr-2 h-4 w-4" /> Add Activity</Button>
                                </div>
                                <div className="space-y-2">
                                    {(activitySettings.activities || []).map(activity => (
                                        <div
                                            key={activity.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, activity.id)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, activity.id)}
                                            onDragEnd={handleDragEnd}
                                            className="flex items-center justify-between p-2 bg-muted rounded-md gap-2"
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                                                <Input value={activity.name} readOnly className="border-0 bg-transparent" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {activity.iconUrl && <Image src={activity.iconUrl} alt={activity.name} width={24} height={24} className="h-6 w-6" />}
                                                <Input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="text-xs file:mr-2 file:text-xs" 
                                                    onChange={(e) => handleActivityIconChange(activity.id, e.target.files ? e.target.files[0] : null)}
                                                />
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveActivity(activity.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity Durations</CardTitle>
                                <CardDescription>Manage the list of available durations for activities.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="e.g., 30 minutes" 
                                        value={newDuration}
                                        onChange={(e) => setNewDuration(e.target.value)}
                                    />
                                    <Button onClick={handleAddDuration}><PlusCircle className="mr-2 h-4 w-4" /> Add Duration</Button>
                                </div>
                                <div className="space-y-2">
                                    {(activitySettings.durations || []).map(duration => (
                                        <div key={duration.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                            <span>{duration.value}</span>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveDuration(duration.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Activity Intensity Levels</CardTitle>
                                <CardDescription>Manage the list of available intensity levels.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Input 
                                        placeholder="e.g., High, Medium, Low" 
                                        value={newIntensity}
                                        onChange={(e) => setNewIntensity(e.target.value)}
                                    />
                                    <Button onClick={handleAddIntensity}><PlusCircle className="mr-2 h-4 w-4" /> Add Intensity</Button>
                                </div>
                                <div className="space-y-2">
                                    {(activitySettings.intensityLevels || []).map(intensity => (
                                        <div key={intensity.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                            <span>{intensity.name}</span>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveIntensity(intensity.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </div>
        </Tabs>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={resetToDefaults}>Reset to Defaults</Button>
        <Button onClick={applySettings} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>Save and Apply Changes</Button>
      </div>
    </div>
  );
}
