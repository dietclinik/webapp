
'use server';

import {
  processNewCustomer as processNewCustomerFlow,
  ProcessCustomerInput,
} from '@/ai/flows/send-welcome-email-flow';

export async function processNewCustomer(
  input: ProcessCustomerInput
): Promise<{ userId?: string | undefined; message:string }> {
  return await processNewCustomerFlow(input);
}
