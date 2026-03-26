
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // The console.error call was removed from here.
      
      const debugMessage = `Path: ${error.context.path}, Operation: ${error.context.operation}`;

      toast({
        variant: 'destructive',
        title: 'Firestore: Insufficient Permissions',
        description: (
          <div className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
            <p className="text-sm text-white">The request was denied by Firestore Security Rules.</p>
            <code className="text-xs text-white/70 block mt-2 whitespace-pre-wrap">{debugMessage}</code>
            <p className="text-xs text-white/70 mt-4">Check the browser console for full details.</p>
          </div>
        ),
        duration: 20000,
      });

      // For Next.js development overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
