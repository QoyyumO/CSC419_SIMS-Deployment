'use client';

import { isStudent } from '@/services/permissions.service';
import AdminDashboard from './_components/AdminDashboard';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  
  return (
    <>
      {isStudent(roles) ? <div>Student Dashboard - Coming Soon</div> : <AdminDashboard />}
    </>
  );
}

