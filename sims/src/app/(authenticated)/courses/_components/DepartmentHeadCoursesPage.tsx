'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Input from '@/components/form/input/InputField';
import CoursesTable from './CoursesTable';

import { Id } from '@/lib/convex';

type Course = {
  _id: Id<'courses'>;
  code: string;
  title: string;
  credits: number;
  department?: {
    _id: Id<'departments'>;
    name: string;
  } | null;
  programs?: Array<{
    _id: Id<'programs'>;
    name: string;
  }>;
  status?: string;
  level?: string;
};

export default function DepartmentHeadCoursesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // Fetch courses from department head's department
  const courses = useQuery(
    api.functions.department.getDepartmentCourses,
    sessionToken
      ? {
          token: sessionToken,
        }
      : 'skip'
  ) as Course[] | undefined;

  const isLoading = courses === undefined;

  // Filter courses by search query on client side
  const filteredCourses = courses?.filter((course) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      course.code.toLowerCase().includes(query) ||
      course.title.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <PageBreadCrumb pageTitle="Department Courses" />

      <div className="space-y-6">
        {/* Search */}
        <ComponentCard title="Search Courses">
          <Input
            type="text"
            placeholder="Search by course code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </ComponentCard>

        {/* Courses Table */}
        <ComponentCard 
          title="Department Courses" 
          desc="Manage courses in your department and create course versions"
        >
          <CoursesTable courses={filteredCourses} isLoading={isLoading} />
        </ComponentCard>
      </div>
    </div>
  );
}
