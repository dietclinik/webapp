
'use server';

import {
  processNewCustomer as processNewCustomerFlow,
  ProcessCustomerInput,
} from '@/ai/flows/send-welcome-email-flow';
import { db } from '@/lib/firebase-admin';

export async function processNewCustomer(
  input: ProcessCustomerInput
): Promise<{ userId?: string | undefined; message:string }> {
  return await processNewCustomerFlow(input);
}

export async function checkCustomerExists(email: string, mobile: string): Promise<boolean> {
  if (!db) return false;
  const customersRef = db.collection('customers');
  const [emailSnap, mobileSnap] = await Promise.all([
    customersRef.where('email', '==', email).limit(1).get(),
    customersRef.where('mobile', '==', mobile).limit(1).get(),
  ]);
  return !emailSnap.empty || !mobileSnap.empty;
}
