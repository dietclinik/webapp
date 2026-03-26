
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write'; // 'write' for generic set/update
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions. The following request was denied by Firestore Security Rules. See console for details.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }

  toDebugJSON() {
    return {
      message: this.message,
      name: this.name,
      context: this.context,
    };
  }
}
