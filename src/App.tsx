@@ .. @@
 import React, { useState, useEffect } from 'react';
 import { User } from '@supabase/supabase-js';
 import { supabase } from './lib/supabase';
 import AdminDashboard from './components/AdminDashboard';
 import PhotoKiosk from './components/PhotoKiosk';
+import LoginPage from './components/Auth/LoginPage';
+import SignupPage from './components/Auth/SignupPage';
+import SuccessPage from './components/SuccessPage';
 import { Event } from './types';
 import { getEventByPasscode } from './services/backendService';
 
 function App() {
   const [user, setUser] = useState<User | null>(null);
   const [loading, setLoading] = useState(true);
   const [kioskEvent, setKioskEvent] = useState<Event | null>(null);
+  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
+  const [showSuccess, setShowSuccess] = useState(false);
 
   useEffect(() => {
     // Check for existing session
@@ -20,6 +25,11 @@ function App() {
     // Check for kiosk mode in URL
     const urlParams = new URLSearchParams(window.location.search);
     const kioskPasscode = urlParams.get('kiosk');
+    const success = urlParams.get('success');
+    
+    if (success === 'true') {
+      setShowSuccess(true);
+    }
     
     if (kioskPasscode) {
       loadKioskEvent(kioskPasscode);
@@ .. @@
   const handleLogout = async () => {
     await supabase.auth.signOut();
     setUser(null);
+    setAuthMode('login');
   };
 
   const handleLaunchKiosk = (event: Event) => {
@@ .. @@
   if (loading) {
     return <div className="flex h-screen items-center justify-center">Loading...</div>;
   }
+  
+  // Show success page after payment
+  if (showSuccess) {
+    return (
+      <SuccessPage 
+        onContinue={() => {
+          setShowSuccess(false);
+          // Clear URL parameters
+          window.history.replaceState({}, document.title, window.location.pathname);
+        }} 
+      />
+    );
+  }
 
   // Kiosk mode - no authentication required
   if (kioskEvent) {
@@ .. @@
   }
 
   // Admin mode - authentication required
-  if (user) {
+  if (user && !authMode) {
     return (
       <AdminDashboard 
         onLogout={handleLogout} 
@@ -49,7 +75,32 @@ function App() {
     );
   }
 
-  return <div className="flex h-screen items-center justify-center">Please sign in to continue.</div>;
+  // Authentication flow
+  if (authMode === 'signup') {
+    return (
+      <SignupPage
+        onSuccess={() => {
+          setAuthMode('login');
+        }}
+        onSwitchToLogin={() => setAuthMode('login')}
+      />
+    );
+  }
+
+  // Default to login page
+  return (
+    <LoginPage
+      onSuccess={() => {
+        setAuthMode(null);
+        // Refresh user state
+        supabase.auth.getUser().then(({ data: { user } }) => {
+          setUser(user);
+        });
+      }}
+      onSwitchToSignup={() => setAuthMode('signup')}
+    />
+  );
 }
 
 export default App;