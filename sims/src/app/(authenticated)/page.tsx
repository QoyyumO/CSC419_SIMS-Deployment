'use client';

import { isStudent } from '@/services/permissions.service';
import AdminDashboard from './_components/AdminDashboard';
import StudentDashboardView from './_components/StudentDashboard';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  
  return (
    <>
      {isStudent(roles) ? <StudentDashboardView /> : <AdminDashboard />}
    </>
  );
}

