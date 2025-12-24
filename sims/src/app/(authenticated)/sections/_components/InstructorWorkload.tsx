'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import ComponentCard from '@/components/common/ComponentCard';
import Loading from '@/components/loading/Loading';
import { UserIcon } from '@/icons';

type InstructorWorkload = {
  _id: Id<'users'>;
  name: string;
  email: string;
  load: number;
};

type Term = {
  _id: Id<'terms'>;
  name: string;
  sessionId: Id<'academicSessions'>;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

interface InstructorWorkloadProps {
  sessionToken: string | null;
  selectedTermId?: Id<'terms'> | undefined;
}

export default function InstructorWorkload({ sessionToken, selectedTermId }: InstructorWorkloadProps) {
  // Fetch current or next active term if no term is provided
  const currentOrNextTerm = useQuery(api.department.getCurrentOrNextTerm) as Term | null | undefined;
  const effectiveTermId = selectedTermId || currentOrNextTerm?._id;

  // Fetch instructor workload
  const instructorWorkloads = useQuery(
    api.department.getInstructorWorkload,
    sessionToken && effectiveTermId
      ? {
          token: sessionToken,
          termId: effectiveTermId,
        }
      : 'skip'
  ) as InstructorWorkload[] | undefined;

  // Fetch terms for display
  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  const isLoading = instructorWorkloads === undefined || terms === undefined;

  // Get the term name for display
  const displayTerm = effectiveTermId
    ? terms?.find((t) => t._id === effectiveTermId)
    : null;

  return (
    <ComponentCard 
      title="Instructor Workload" 
      desc={displayTerm 
        ? `View instructor assignments for ${displayTerm.name} (${displayTerm.sessionYearLabel})`
        : "View instructor assignments and workload distribution"}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      ) : !instructorWorkloads || instructorWorkloads.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <UserIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No instructors found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instructorWorkloads.map((instructor) => (
            <div
              key={instructor._id}
              className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                instructor.load === 0
                  ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/20">
                  <UserIcon className="h-5 w-5 text-brand-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90">
                    {instructor.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {instructor.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                    instructor.load === 0
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {instructor.load} {instructor.load === 1 ? 'Section' : 'Sections'} Assigned
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ComponentCard>
  );
}

