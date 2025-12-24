'use client';

import { isStudent, isDepartmentHead } from '@/services/permissions.service';
import AdminDashboard from './_components/AdminDashboard';
import StudentDashboardView from './_components/StudentDashboard';
import DepartmentHeadDashboard from './_components/DepartmentHeadDashboard';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  
  if (isStudent(roles)) {
    return <StudentDashboardView />;
  }
  
  if (isDepartmentHead(roles)) {
    return <DepartmentHeadDashboard />;
  }
  
  return <AdminDashboard />;
}

