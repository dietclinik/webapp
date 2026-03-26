
"use client";

import { redirect } from 'next/navigation';

export default function DashboardPage() {
    // Redirect to a default dashboard page
    redirect('/dashboard/overview');
}
