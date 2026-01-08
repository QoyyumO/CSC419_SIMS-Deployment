'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api, Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Input from '@/components/form/input/InputField';
import CoursesTable from './CoursesTable';

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

export default function StudentCoursesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize session token from localStorage using lazy initialization
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  // Fetch courses with search filter
  // Note: Courses are automatically filtered by student's department and level in the backend
  const courses = useQuery(
    api.functions.courses.listPublic,
    sessionToken
      ? {
          token: sessionToken,
          searchQuery: searchQuery || undefined,
        }
      : 'skip'
  ) as Course[] | undefined;

  const isLoading = courses === undefined;

  return (
    <div>
      <PageBreadCrumb pageTitle="Courses" />

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
        <ComponentCard title="Courses" desc="Browse available courses to enroll">
          <CoursesTable courses={courses} isLoading={isLoading} />
        </ComponentCard>
      </div>
    </div>
  );
}
