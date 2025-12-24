'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import Select from '@/components/form/Select';
import Label from '@/components/form/Label';
import { useModal } from '@/hooks/useModal';
import { PlusIcon, DownloadIcon } from '@/icons';
import { RoleGuard } from '@/components/auth/RoleGuard';
import SectionsTable from './_components/SectionsTable';
import CreateSectionModal from './_components/CreateSectionModal';
import InstructorWorkload from './_components/InstructorWorkload';
import TermPlanner from './_components/TermPlanner';

type Section = {
  _id: Id<'sections'>;
  courseCode: string;
  courseTitle: string;
  sectionId: Id<'sections'>;
  instructorId: Id<'users'> | null;
  instructorName: string;
  capacity: number;
  enrollmentCount: number;
  status: string;
  termId: Id<'terms'>;
  termName: string;
  sessionYearLabel: string;
  isOpenForEnrollment: boolean;
};

type Term = {
  _id: Id<'terms'>;
  name: string;
  sessionId: Id<'academicSessions'>;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

export default function SectionsPage() {
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const [selectedTermId, setSelectedTermId] = useState<Id<'terms'> | undefined>(undefined);
  const createModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null);
  const [assignmentToastMessage, setAssignmentToastMessage] = useState<string | null>(null);

  const publishSections = useMutation(api.department.publishSections);

  // Fetch current or next active term
  const currentOrNextTerm = useQuery(api.department.getCurrentOrNextTerm) as Term | null | undefined;

  // Fetch assignment report for CSV export
  const effectiveTermId = selectedTermId || currentOrNextTerm?._id;
  const assignmentReport = useQuery(
    api.department.getAssignmentReport,
    sessionToken && effectiveTermId
      ? {
          token: sessionToken,
          termId: effectiveTermId,
        }
      : sessionToken
      ? { token: sessionToken }
      : 'skip'
  ) as Array<{ Term: string; Session: string; Course: string; InstructorName: string; Capacity: number }> | undefined;

  // Fetch terms
  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  // Set default term to current/next term if no term is selected
  useEffect(() => {
    if (currentOrNextTerm && !selectedTermId) {
      // Use setTimeout to avoid calling setState synchronously within effect
      setTimeout(() => {
        setSelectedTermId(currentOrNextTerm._id);
      }, 0);
    }
  }, [currentOrNextTerm, selectedTermId]);

  // Fetch sections - use selectedTermId or currentOrNextTerm
  const sections = useQuery(
    api.department.getSections,
    sessionToken && effectiveTermId
      ? {
          token: sessionToken,
          termId: effectiveTermId,
        }
      : 'skip'
  ) as Section[] | undefined;

  const isLoading = sections === undefined || terms === undefined;

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    createModal.closeModal();
  };

  const handlePublishAllReady = async () => {
    if (!sessionToken || !sections || sections.length === 0) {
      setPublishErrorMessage('No sections available to publish');
      setTimeout(() => setPublishErrorMessage(null), 3000);
      return;
    }

    // Filter sections that are ready to publish (have instructor assigned and are in Draft status)
    const readySections = sections.filter(
      (section) => section.status === 'Active' && !section.isOpenForEnrollment
    );

    if (readySections.length === 0) {
      setPublishErrorMessage('No sections ready to publish. Sections must have an assigned instructor.');
      setTimeout(() => setPublishErrorMessage(null), 3000);
      return;
    }

    try {
      setPublishErrorMessage(null);
      const result = await publishSections({
        token: sessionToken,
        sectionIds: readySections.map((s) => s._id),
      });
      setPublishMessage(`Successfully published ${result.count} section(s)`);
      setTimeout(() => setPublishMessage(null), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish sections';
      setPublishErrorMessage(errorMessage);
      setTimeout(() => setPublishErrorMessage(null), 5000);
    }
  };

  const handleExportCSV = () => {
    if (!assignmentReport || assignmentReport.length === 0) {
      setPublishErrorMessage('No data available to export');
      setTimeout(() => setPublishErrorMessage(null), 3000);
      return;
    }

    // Create CSV content
    const headers = ['Term', 'Session', 'Course', 'InstructorName', 'Capacity'];
    const csvRows = [
      headers.join(','),
      ...assignmentReport.map((row) =>
        [
          `"${row.Term}"`,
          `"${row.Session}"`,
          `"${row.Course}"`,
          `"${row.InstructorName}"`,
          row.Capacity.toString(),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `assignment-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAssignmentChange = () => {
    setAssignmentToastMessage('Assignment saved successfully');
    setTimeout(() => setAssignmentToastMessage(null), 3000);
  };

  const handleSectionDeleted = () => {
    setAssignmentToastMessage('Section deleted successfully');
    setTimeout(() => setAssignmentToastMessage(null), 3000);
  };

  const termOptions = [
    { value: '', label: 'All Terms' },
    ...(terms?.map((term) => ({
      value: term._id,
      label: `${term.name} (${term.sessionYearLabel})`,
    })) || []),
  ];

  return (
    <RoleGuard role="department_head" unauthorizedMessage="You must be a department head to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Sections" />

        <div className="space-y-6">
          {showSuccessMessage && (
            <Alert variant="success" title="Success" message="Section created successfully!" />
          )}
          {publishMessage && (
            <Alert variant="success" title="Success" message={publishMessage} />
          )}
          {publishErrorMessage && (
            <Alert variant="error" title="Error" message={publishErrorMessage} />
          )}
          {assignmentToastMessage && (
            <Alert variant="success" title="Success" message={assignmentToastMessage} />
          )}

          {/* Term Planner */}
          <TermPlanner
            sessionToken={sessionToken}
            selectedTermId={effectiveTermId}
            onSuccess={handleSuccess}
          />

          {/* Filters and Create Button */}
          <ComponentCard title="Filters">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="termFilter">Term:</Label>
                  <div className="relative w-full sm:w-48">
                    <Select
                      options={termOptions}
                      placeholder="Select a term"
                      onChange={(e) =>
                        setSelectedTermId(
                          e.target.value ? (e.target.value as Id<'terms'>) : undefined
                        )
                      }
                      defaultValue={selectedTermId || ''}
                    />
                  </div>
                </div>
              </div>
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createModal.openModal}
              >
                Create Section
              </Button>
            </div>
          </ComponentCard>
          {/* Sections Table */}
          <ComponentCard title="Sections" desc="Manage course sections for your department">
            <div className="mb-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                startIcon={<DownloadIcon className="h-4 w-4" />}
                onClick={handleExportCSV}
                disabled={!sessionToken || !assignmentReport || assignmentReport.length === 0}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePublishAllReady}
                disabled={!sessionToken || !sections || sections.length === 0}
              >
                Publish All Ready Sections
              </Button>
            </div>
            <SectionsTable 
              sections={sections} 
              isLoading={isLoading}
              sessionToken={sessionToken}
              selectedTermId={effectiveTermId}
              onAssignmentChange={handleAssignmentChange}
              onSectionDeleted={handleSectionDeleted}
            />
          </ComponentCard>

          {/* Instructor Workload */}
          <InstructorWorkload sessionToken={sessionToken} selectedTermId={effectiveTermId} />
        </div>

        {/* Create Section Modal */}
        <CreateSectionModal
          isOpen={createModal.isOpen}
          onClose={createModal.closeModal}
          onSuccess={handleSuccess}
        />
      </div>
    </RoleGuard>
  );
}

