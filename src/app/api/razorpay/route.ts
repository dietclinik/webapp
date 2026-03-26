
import {NextResponse} from 'next/server';
import Razorpay from 'razorpay';
import {z} from 'zod';

const orderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional().default('INR'),
});

export async function POST(req: Request) {
  const json = await req.json();

  const parsed = orderSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {error: 'Invalid request payload'},
      {status: 400}
    );
  }

  const {amount, currency} = parsed.data;

  const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const options = {
    amount: Math.round(amount * 100), // amount in the smallest currency unit
    currency,
    receipt: `receipt_order_${new Date().getTime()}`,
    payment_capture: 1, // Explicitly enable auto-capture
  };

  try {
    const order = await razorpay.orders.create(options);
    return NextResponse.json(order);
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return NextResponse.json(
      {error: 'Failed to create Razorpay order'},
      {status: 500}
    );
  }
}
