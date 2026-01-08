'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Id } from '@/lib/convex';
import { useAuth } from '@/hooks/useAuth';
import { isStudent, isDepartmentHead } from '@/services/permissions.service';
import CourseVersionsPage from '../../_components/CourseVersionsPage';

export default function CourseVersionsPageRoute() {
  const params = useParams();
  const courseId = (Array.isArray(params.courseId) ? params.courseId[0] : params.courseId) as Id<'courses'> | undefined;
  const { user } = useAuth();
  const roles = user?.roles || [];
  const userIsStudent = isStudent(roles);
  const userIsDepartmentHead = isDepartmentHead(roles);

  // Only allow students and department heads
  if (!userIsStudent && !userIsDepartmentHead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4 dark:text-red-400">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Only students and department heads can access course versions.
          </p>
        </div>
      </div>
    );
  }

  if (!courseId) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">Invalid course ID</p>
      </div>
    );
  }

  return <CourseVersionsPage courseId={courseId} />;
}
