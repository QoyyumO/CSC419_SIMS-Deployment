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
    // This will be implemented in the next task (task 6)
    // For now, just close the modal
    setApprovalModalOpen(false);
    setSelectedStudentForApproval(null);
  };

  return (
    <RoleGuard
      roles={['admin', 'registrar', 'department_head']}
      unauthorizedMessage="You must be an administrator, registrar, or department head to access this page."
    >
      <div>
        <PageBreadCrumb pageTitle="Graduation Management" />

        <div className="space-y-6">
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
              setApprovalModalOpen(false);
              setSelectedStudentForApproval(null);
            }}
            onConfirm={handleConfirmApproval}
            studentInfo={selectedStudentForApproval}
            eligibilityResult={eligibilityResult}
          />
        </div>
      </div>
    </RoleGuard>
  );
}

