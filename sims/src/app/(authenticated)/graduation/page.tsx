'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/../convex/_generated/dataModel';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Input from '@/components/form/input/InputField';
import Select from '@/components/form/Select';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import StudentsEligibilityTable from './_components/StudentsEligibilityTable';
import Alert from '@/components/ui/alert/Alert';
import GraduationApprovalModal from './_components/GraduationApprovalModal';

export default function GraduationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [checkingStudentId, setCheckingStudentId] = useState<Id<'students'> | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<{
    studentId: Id<'students'>;
    eligible: boolean;
    missingRequirements: string[];
    totalCredits: number;
    requiredCredits: number;
    gpa: number;
    requiredGPA: number;
  } | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedStudentForApproval, setSelectedStudentForApproval] = useState<{
    studentId: Id<'students'>;
    name: string;
    studentNumber: string;
  } | null>(null);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch students for graduation management
  const students = useQuery(
    (api as any)['mutations/graduationMutations'].getAllStudentsForGraduation,
    user?._id
      ? {
          requesterUserId: user._id,
          departmentId: departmentId ? (departmentId as Id<'departments'>) : undefined,
          searchTerm: searchQuery || undefined,
        }
      : 'skip'
  ) as any[] | undefined;

  // Fetch departments for filter
  const departments = useQuery(api.departments.list) as any[] | undefined;

  // Mutation to check graduation eligibility
  const checkEligibilityMutation = useMutation(
    (api as any)['mutations/graduationMutations'].checkGraduationEligibility
  );

  // Mutation to process student graduation
  const processGraduationMutation = useMutation(
    (api as any)['mutations/graduationMutations'].processStudentGraduation
  );

  const isLoading = students === undefined;

  const handleCheckEligibility = async (studentId: Id<'students'>) => {
    setCheckingStudentId(studentId);
    setEligibilityResult(null);

    try {
      const result = await checkEligibilityMutation({ studentId });
      setEligibilityResult({
        studentId,
        ...result,
      });
    } catch (error) {
      console.error('Error checking eligibility:', error);
      // Error will be handled by the UI
    } finally {
      setCheckingStudentId(null);
    }
  };

  const handleApproveGraduation = (studentId: Id<'students'>) => {
    const student = students?.find((s) => s._id === studentId);
    if (student && eligibilityResult && eligibilityResult.studentId === studentId) {
      setSelectedStudentForApproval({
        studentId,
        name: student.name,
        studentNumber: student.studentNumber,
      });
      setApprovalModalOpen(true);
    }
  };

  const handleConfirmApproval = async () => {
    if (!selectedStudentForApproval || !user?._id) {
      return;
    }

    setIsProcessingApproval(true);
    setApprovalError(null);
    setApprovalSuccess(null);

    try {
      const result = await processGraduationMutation({
        studentId: selectedStudentForApproval.studentId,
        approverUserId: user._id,
      });

      // Show success message
      setApprovalSuccess(
        `Graduation approved successfully for ${selectedStudentForApproval.name}. Alumni profile created.`
      );

      // Clear eligibility result and close modal
      setEligibilityResult(null);
      setApprovalModalOpen(false);
      setSelectedStudentForApproval(null);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setApprovalSuccess(null);
      }, 5000);
    } catch (error) {
      // Extract user-friendly error message
      let errorMessage = 'Failed to approve graduation. Please try again.';
      if (error instanceof Error) {
        const rawMessage = error.message;
        // Extract meaningful error message from Convex error format
        const userMessageMatch = rawMessage.match(
          /Student does not meet graduation requirements:([^]*?)(?:\s+at\s|$)/
        );
        if (userMessageMatch) {
          errorMessage = `Cannot approve graduation: ${userMessageMatch[1].trim()}`;
        } else {
          // Try to extract other error messages
          const cleanedMessage = rawMessage
            .replace(/\[CONVEX[^\]]+\]\s*/g, '')
            .replace(/\[Request ID:[^\]]+\]\s*/g, '')
            .replace(/Server Error\s*/g, '')
            .replace(/Uncaught Error:\s*/g, '')
            .replace(/\s*at handler[^]*$/g, '')
            .replace(/\s*Called by client[^]*$/g, '')
            .trim();

          if (cleanedMessage.length > 0 && cleanedMessage.length < 200) {
            errorMessage = cleanedMessage;
          }
        }
      }
      setApprovalError(errorMessage);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  return (
    <RoleGuard
      roles={['registrar']}
      unauthorizedMessage="You must be a registrar to access this page."
    >
      <div>
        <PageBreadCrumb pageTitle="Graduation Management" />

        <div className="space-y-6">
          {/* Success Alert */}
          {approvalSuccess && (
            <Alert
              variant="success"
              title="Graduation Approved"
              message={approvalSuccess}
            />
          )}

          {/* Error Alert */}
          {approvalError && (
            <Alert
              variant="error"
              title="Approval Failed"
              message={approvalError}
            />
          )}

          {/* Eligibility Result Alert */}
          {eligibilityResult && (
            <Alert
              variant={eligibilityResult.eligible ? 'success' : 'warning'}
              title={
                eligibilityResult.eligible
                  ? 'Student is Eligible for Graduation'
                  : 'Student is Not Eligible for Graduation'
              }
              message={
                eligibilityResult.eligible
                  ? `GPA: ${eligibilityResult.gpa.toFixed(2)}/${eligibilityResult.requiredGPA}, Credits: ${eligibilityResult.totalCredits}/${eligibilityResult.requiredCredits}`
                  : `Missing requirements: ${eligibilityResult.missingRequirements.join('; ')}`
              }
            />
          )}

          {/* Filters */}
          <ComponentCard title="Filters">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search by name or student number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    options={[
                      { value: '', label: 'All Departments' },
                      ...(departments?.map((d) => ({
                        value: d._id,
                        label: d.name,
                      })) || []),
                    ]}
                    placeholder="Select Department"
                    defaultValue={departmentId || ''}
                    onChange={(e) => setDepartmentId(e.target.value || undefined)}
                  />
                </div>
              </div>
            </div>
          </ComponentCard>

          {/* Students Table */}
          <ComponentCard
            title="Students"
            desc="View and check graduation eligibility for students"
          >
            <StudentsEligibilityTable
              students={students}
              isLoading={isLoading}
              onCheckEligibility={handleCheckEligibility}
              checkingStudentId={checkingStudentId}
              eligibilityResult={eligibilityResult}
              onApproveGraduation={handleApproveGraduation}
            />
          </ComponentCard>

          {/* Graduation Approval Modal */}
          <GraduationApprovalModal
            isOpen={approvalModalOpen}
            onClose={() => {
              if (!isProcessingApproval) {
                setApprovalModalOpen(false);
                setSelectedStudentForApproval(null);
                setApprovalError(null);
              }
            }}
            onConfirm={handleConfirmApproval}
            studentInfo={selectedStudentForApproval}
            eligibilityResult={eligibilityResult}
            isProcessing={isProcessingApproval}
          />
        </div>
      </div>
    </RoleGuard>
  );
}

