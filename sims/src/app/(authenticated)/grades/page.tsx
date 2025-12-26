'use client';

import React, { useState } from 'react';
import { useHasRole } from '@/hooks/useHasRole';
import RegistrarView from './_components/RegistrarView';
import StudentView from './_components/StudentView';

export default function GradesPage() {
  // Check if user is registrar
  const isRegistrar = useHasRole('registrar');
  
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // Render appropriate view based on user role
  if (isRegistrar) {
    return <RegistrarView sessionToken={sessionToken} />;
  }

  return <StudentView sessionToken={sessionToken} />;
}

