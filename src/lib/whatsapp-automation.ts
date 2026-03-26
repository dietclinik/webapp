import { db, admin } from './firebase-admin';
import { sendRenewalReminder, sendPlanExpired, sendDietLogReminder } from './whatsapp-helpers';
import { differenceInDays, startOfDay, endOfDay, isSameDay } from 'date-fns';

/**
 * Check and send renewal reminders for customers
 */
export async function checkRenewalReminders() {
    if (!db) return { success: false, error: 'Database not initialized' };

    const now = new Date();
    const today = startOfDay(now);

    try {
        const customersSnapshot = await db.collection('customers')
            .where('status', '==', 'Active')
            .get();

        const results = {
            sent: 0,
            skipped: 0,
            errors: 0
        };

        for (const doc of customersSnapshot.docs) {
            const customer = doc.data();
            if (!customer.subscriptionEndDate || !customer.mobile) continue;

            const endDate = customer.subscriptionEndDate.toDate();
            const daysRemaining = differenceInDays(startOfDay(endDate), today);

            // Trigger on 7, 3, 0 days remaining, or -2 days (overdue)
            if ([7, 3, 0, -2].includes(daysRemaining)) {
                try {
                    await sendRenewalReminder({
                        phone: customer.mobile,
                        name: customer.name,
                        userId: doc.id,
                        planName: customer.planId || 'Standard Plan', // You might want to fetch actual plan name
                        expiryDate: endDate.toLocaleDateString(),
                        daysRemaining: daysRemaining
                    });
                    results.sent++;
                } catch (err) {
                    console.error(`Error sending renewal reminder to ${customer.email}:`, err);
                    results.errors++;
                }
            } else {
                results.skipped++;
            }
        }

        return { success: true, results };
    } catch (error: any) {
        console.error('Error in checkRenewalReminders:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check and process expired subscriptions
 */
export async function checkExpiredSubscriptions() {
    if (!db) return { success: false, error: 'Database not initialized' };

    const now = new Date();

    try {
        const customersSnapshot = await db.collection('customers')
            .where('status', '==', 'Active')
            .get();

        const results = {
            expired: 0,
            errors: 0
        };

        for (const doc of customersSnapshot.docs) {
            const customer = doc.data();
            if (!customer.subscriptionEndDate) continue;

            const endDate = customer.subscriptionEndDate.toDate();

            if (endDate < now) {
                try {
                    // Update status to Inactive
                    await doc.ref.update({
                        status: 'Inactive',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Send notification
                    if (customer.mobile) {
                        await sendPlanExpired({
                            phone: customer.mobile,
                            name: customer.name,
                            userId: doc.id,
                            planName: customer.planId || 'Plan',
                            expiredDate: endDate.toLocaleDateString()
                        });
                    }
                    results.expired++;
                } catch (err) {
                    console.error(`Error processing expiry for ${customer.email}:`, err);
                    results.errors++;
                }
            }
        }

        return { success: true, results };
    } catch (error: any) {
        console.error('Error in checkExpiredSubscriptions:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send reminders to customers who haven't logged their diet for today
 * Intended to run at 7:00 PM
 */
export async function sendDailyDietLogReminders() {
    if (!db) return { success: false, error: 'Database not initialized' };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    try {
        const activeCustomersSnapshot = await db.collection('customers')
            .where('status', '==', 'Active')
            .get();

        const results = {
            reminded: 0,
            skipped: 0,
            errors: 0
        };

        for (const customerDoc of activeCustomersSnapshot.docs) {
            const customer = customerDoc.data();
            const customerId = customerDoc.id;

            // Check if there's a log for today in 'dietLogs' collection
            const logSnapshot = await db.collection('dietLogs')
                .where('userId', '==', customerId)
                .where('date', '>=', admin.firestore.Timestamp.fromDate(todayStart))
                .where('date', '<=', admin.firestore.Timestamp.fromDate(todayEnd))
                .limit(1)
                .get();

            if (logSnapshot.empty) {
                // No log found, send reminder
                if (customer.mobile) {
                    try {
                        await sendDietLogReminder({
                            phone: customer.mobile,
                            name: customer.name,
                            userId: customerId
                        });
                        results.reminded++;
                    } catch (err) {
                        console.error(`Error sending diet log reminder to ${customer.email}:`, err);
                        results.errors++;
                    }
                }
            } else {
                results.skipped++;
            }
        }

        return { success: true, results };
    } catch (error: any) {
        console.error('Error in sendDailyDietLogReminders:', error);
        return { success: false, error: error.message };
    }
}
