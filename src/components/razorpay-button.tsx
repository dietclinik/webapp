
"use client";

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/use-settings';

type RazorpayButtonProps = {
    planName: string;
    amount: number; // in rupees
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    onPaymentSuccess: (response: any) => void;
    onPaymentError: (error: any) => void;
    onBeforePayment?: () => Promise<string | null>;
    disabled?: boolean;
    buttonText?: string;
    closeDialog?: () => void;
    buttonSize?: "default" | "sm" | "lg" | "icon" | null | undefined;
};

declare global {
    interface Window {
        Razorpay: any;
    }
}

const RazorpayButton = ({
    planName,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    onPaymentSuccess,
    onPaymentError,
    onBeforePayment,
    disabled = false,
    buttonText = "Choose Plan",
    closeDialog,
    buttonSize = "default",
}: RazorpayButtonProps) => {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { settings, loading: settingsLoading } = useSettings();
    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handlePayment = async () => {
        setLoading(true);

        if (closeDialog) {
            closeDialog();
        }

        let registrationId: string | null = null;
        if (onBeforePayment) {
            registrationId = await onBeforePayment();
            if (!registrationId) {
                setLoading(false);
                // The onBeforePayment function should handle its own toasts for failure.
                return;
            }
        }

        if (!razorpayKey) {
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'Razorpay Key ID is not configured. Please contact support.',
            });
            setLoading(false);
            return;
        }

        // Create order through API to enable auto capture
        try {
            const orderResponse = await fetch('/api/razorpay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    currency: 'INR',
                }),
            });

            if (!orderResponse.ok) {
                throw new Error('Failed to create order');
            }

            const orderData = await orderResponse.json();

            const options = {
                key: razorpayKey,
                amount: orderData.amount,
                currency: orderData.currency,
                order_id: orderData.id, // This is required for auto capture
                name: settings?.themeSettings?.appName || 'Diet Clinik Portal',
                description: `Payment for ${planName}`,
                handler: function (response: any) {
                    onPaymentSuccess({ ...response, registrationId });
                    setLoading(false);
                },
                prefill: {
                    name: customerName,
                    email: customerEmail,
                    contact: customerPhone,
                },
                notes: {
                    plan: planName,
                    registration_id: registrationId,
                },
                theme: {
                    color: '#109a49',
                },
                modal: {
                    ondismiss: function () {
                        onPaymentError({ error: { description: 'Payment window was closed.' }, registrationId });
                        setLoading(false);
                    },
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                onPaymentError({ ...response.error.metadata, registrationId });
                setLoading(false);
            });
            rzp.open();
        } catch (error) {
            console.error("Razorpay Error:", error);
            toast({
                variant: 'destructive',
                title: 'Payment Error',
                description: 'Could not initiate Razorpay checkout. Please try again.',
            });
            setLoading(false);
        }
    };

    return (
        <Button onClick={handlePayment} disabled={disabled || loading || settingsLoading} size={buttonSize} className="w-full">
            {loading || settingsLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                buttonText
            )}
        </Button>
    );
};

export default RazorpayButton;
