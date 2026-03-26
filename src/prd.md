
# **App Name**: Diet Clinik Portal

## Core Features:

### 1. Admin Portal

-   **Secure Admin Login:** A dedicated and secure login page for administrators.
-   **Dashboard:** A comprehensive overview of the business, including:
    -   Key performance indicators: Total Revenue, Total Expenses, Active Subscriptions, and Active Customers.
    -   An interactive bar chart visualizing monthly income versus expenses for the current year.
    -   A list of the most recent customer sign-ups.
-   **Customer Management:**
    -   Add, view, edit, and delete customer profiles.
    -   Search and sort the customer list.
    -   View detailed customer profiles including personal info, health stats (BMI/BMR), subscription details, custom fields, measurement logs, and meal logs (including notes, photos, and skipped meals).
    -   Manually activate accounts for customers with failed payments.
    -   Assign specific staff members to customers.
-   **Staff Management:**
    -   Add, view, edit, and delete staff member profiles.
    -   Upload staff photos and resumes.
    -   Enable or disable staff login access.
    -   View a list of customers assigned to each staff member.
-   **Subscription Plan Management:**
    -   Create, edit, and delete subscription plans.
    -   Define plan details: name, price, duration (months and days), description, tier (Basic, Premium, Pro), and a special tag (e.g., "Most Popular").
    -   Set a display order for plans on the homepage.
    -   Categorize plans as "Dietician-Managed" or "Self-Managed".
    -   Toggle plan visibility on the public-facing homepage.
-   **Diet Plan Template Builder:**
    -   Create and manage reusable, option-based diet plan templates.
    -   **AI-Powered Nutrition:** Automatically calculate nutritional information (calories, protein, fat, carbs) for food items by simply entering their name and quantity.
    -   Build plans with multiple meals, each having several food options for flexibility.
-   **Expense Tracking:** A simple interface to log and manage business-related expenses.
-   **Notifications:** A real-time notification system for key events like new registrations, payment failures, customer meal logs, and new staff additions.
-   **Global Settings:**
    -   **Branding & Theme:** Customize the app's name, upload a logo, and configure the entire color scheme (primary, accent, background colors) for both light and dark modes. Adjust font families and sizes.
    -   **Homepage Content:** Edit the text content for the hero section, features section, and call-to-action on the public homepage.
    -   **Custom Fields:** Add custom data fields to various modules like Customers, Staff, and Plans to capture additional information.
    -   **Page Access Control:** Restrict access to specific customer dashboard pages based on their subscription tier and plan type.
-   **Integrated Chat:** A real-time chat widget for communicating directly with staff and customers.

### 2. Staff Portal

-   **Secure Staff Login:** A separate login portal for staff members.
-   **Dashboard:** An overview of assigned customers and created diet plans.
-   **My Customers:** View a list of all customers assigned to the logged-in staff member.
-   **Customer Profile View:** Access a detailed view of assigned customers, including their health profile, subscription details, measurement logs, and their daily meal logs (with notes, photos, and skipped meal reasons).
-   **Diet Plan Management:**
    -   Create, edit, and manage personal diet plan templates using the same AI-powered builder available to admins.
    -   Assign these custom-built diet plans to their customers.
-   **Profile Management:** Staff can update their own personal details and profile picture.
-   **Integrated Chat:** Communicate with assigned customers and administrators.

### 3. Customer Portal & Public Site

-   **Homepage:** A public-facing page displaying subscription plans that can be edited by the admin.
-   **Payment Gateway Integration:** Redirects users to Razorpay for secure payment processing when a plan is selected.
-   **Registration & Renewal:**
    -   New users can register and pay for a plan.
    -   Existing users are recognized by their email and can seamlessly renew or upgrade their plan.
-   **Customer Login:** Secure login for subscribed customers.
-   **Dietician Diet Plan:**
    -   View the diet plan assigned by a staff member or admin.
    -   **Interactive Meal Logging:** Log meals using a simple, interactive checkbox system.
    -   **Notes & Photo Upload:** Add text notes and upload a compressed photo (up to 500KB) for each meal.
    -   **Skip Logging:** Mark an entire day or individual meals as "skipped" and provide a reason.
    -   **Calendar View:** A full monthly calendar provides a visual overview of logging history. Logged days are marked in green, and missed days are marked in red.
    -   **Read-Only History:** Customers can view logs from previous days but cannot edit them. Editing is restricted to the current day.
-   **Self-Diet Plan:** A separate section for customers on "Self-Managed" plans to create and track their own daily meal logs.
-   **Progress Tracking:**
    -   Log daily/weekly weight and body measurements (chest, waist, hips).
    -   View a graph visualizing weight progress over time.
    -   See current BMI and BMR calculations based on the latest measurements.
-   **Profile Management:** Customers can update their personal details, health information, and profile picture.
-   **Subscription Management:** View current subscription details and renew or upgrade the plan.
-   **Notifications:** Receive real-time notifications from admins or staff.
-   **Integrated Chat:** Communicate directly with their assigned staff member and/or admin support.

## Style Guidelines:

-   **Primary Color:** Soft, natural green (`#109a49`) to evoke health and wellness.
-   **Background Color:** Light, desaturated beige (`#F5F5DC`).
-   **Accent Color:** Muted orange (`#D2691E`) for call-to-action buttons.
-   **Font:** 'Inter' sans-serif font to give it a modern and clean look.
-   **Layout:** A clean, minimalist layout with a clear information hierarchy for easy navigation. Use of cards, badges, and modern UI components from ShadCN.
-   **Icons:** Use simple, clean icons from `lucide-react` to represent different features.
-   **Animations:** Incorporate subtle animations and transitions to enhance user experience.
