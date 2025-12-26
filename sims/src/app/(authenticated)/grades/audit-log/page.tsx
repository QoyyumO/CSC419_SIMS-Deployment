'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/../convex/_generated/dataModel';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Loading from '@/components/loading/Loading';
import Alert from '@/components/ui/alert/Alert';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Badge from '@/components/ui/badge/Badge';
import Select from '@/components/form/Select';
import { useHasRole } from '@/hooks/useHasRole';

type AuditLogEntry = {
  _id: Id<"grade_audit_log">;
  adminId: Id<"users">;
  adminName: string;
  sectionId: Id<"sections">;
  sectionName: string;
  action: 'UNLOCK' | 'LOCK';
  reason: string;
  timestamp: number;
};

type SectionStatus = {
  _id: Id<"sections">;
  courseCode: string;
  courseTitle: string;
  gradeStatus: "Grades Submitted" | "Pending" | "Locked";
  finalGradesPosted: boolean;
  gradesEditable: boolean;
  isLocked: boolean;
};

export default function GradeAuditLogPage() {
  const isRegistrar = useHasRole('registrar');

  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const [selectedSection, setSelectedSection] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Update current time periodically for "time ago" calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch audit log entries
  const auditLogs = useQuery(
    api.registrar.getGradeAuditLog,
    isRegistrar && sessionToken
      ? {
          token: sessionToken,
          sectionId: selectedSection ? (selectedSection as Id<"sections">) : undefined,
        }
      : 'skip'
  ) as AuditLogEntry[] | undefined | Error;

  // Fetch sections for filter
  const sectionsStatus = useQuery(
    api.registrar.getAllSectionsStatus,
    isRegistrar && sessionToken
      ? {
          token: sessionToken,
        }
      : 'skip'
  ) as SectionStatus[] | undefined | Error;

  // Format date and time
  const formatDateTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const diff = currentTime - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} min ago`;
    } else {
      return 'Just now';
    }
  };

  // Loading and error states
  const isLoading = auditLogs === undefined;
  const isError = auditLogs instanceof Error;
  const hasData = Array.isArray(auditLogs) && auditLogs.length > 0;

  // Check access
  if (!isRegistrar) {
    return (
      <div>
        <PageBreadCrumb 
          items={[
            { name: 'Grades', href: '/grades' },
            { name: 'Grade Audit Log' },
          ]}
        />
        <div className="space-y-6">
          <Alert
            variant="error"
            title="Access Denied"
            message="You do not have permission to view the grade audit log."
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageBreadCrumb 
          items={[
            { name: 'Grades', href: '/grades' },
            { name: 'Grade Audit Log' },
          ]}
        />
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = auditLogs instanceof Error ? auditLogs.message : 'An error occurred while loading audit log.';
    return (
      <div>
        <PageBreadCrumb 
          items={[
            { name: 'Grades', href: '/grades' },
            { name: 'Grade Audit Log' },
          ]}
        />
        <div className="space-y-6">
          <Alert
            variant="error"
            title="Error Loading Data"
            message={errorMessage}
          />
        </div>
      </div>
    );
  }

  // Get unique sections for filter
  const sections = Array.isArray(sectionsStatus)
    ? sectionsStatus.map((s) => ({
        value: s._id,
        label: `${s.courseCode} - ${s.courseTitle}`,
      }))
    : [];

  return (
    <div>
      <PageBreadCrumb 
        items={[
          { name: 'Grades', href: '/grades' },
          { name: 'Grade Audit Log' },
        ]}
      />

      <div className="space-y-6">
        {/* Filter */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Section
          </label>
          <Select
            options={[
              { value: '', label: 'All Sections' },
              ...sections,
            ]}
            placeholder="Select Section"
            defaultValue={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          />
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                  Date & Time
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                  Section
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                  Action
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                  Admin
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
                  Reason
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasData ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    No audit log entries found.
                  </TableCell>
                </TableRow>
              ) : (
                (auditLogs as AuditLogEntry[]).map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell className="px-5 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {formatDateTime(entry.timestamp)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimeAgo(entry.timestamp)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="text-sm text-gray-800 dark:text-white/90">
                        {entry.sectionName}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <Badge
                        color={entry.action === 'UNLOCK' ? 'success' : 'info'}
                        variant="light"
                        size="sm"
                      >
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="text-sm text-gray-800 dark:text-white/90">
                        {entry.adminName}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="max-w-md text-sm text-gray-700 dark:text-gray-300">
                        {entry.reason}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

