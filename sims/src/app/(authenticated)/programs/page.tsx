'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import { useModal } from '@/hooks/useModal';
import { PlusIcon } from '@/icons';
import { RoleGuard } from '@/components/auth/RoleGuard';
import ProgramsTable from './_components/ProgramsTable';
import CreateProgram from './_components/CreateProgramForm';

type Program = {
  _id: Id<'programs'>;
  name: string;
  departmentId: Id<'departments'>;
  departmentName: string;
  durationYears: number;
  creditRequirements: number;
  requiredCoursesCount: number;
};

export default function ProgramsPage() {
  const createModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Fetch programs
  const programs = useQuery(api.programs.list) as Program[] | undefined;

  const isLoading = programs === undefined;

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  return (
    <RoleGuard role="admin" unauthorizedMessage="You must be an administrator to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Programs" />

        <div className="space-y-6">
          {showSuccessMessage && (
            <Alert variant="success" title="Success" message="Program created successfully!" />
          )}

          {/* Create Button and Programs Table */}
          <ComponentCard title="Programs" desc="Manage academic programs in the system">
            <div className="mb-4 flex justify-end">
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createModal.openModal}
              >
                Create Program
              </Button>
            </div>
            <ProgramsTable programs={programs} isLoading={isLoading} />
          </ComponentCard>
        </div>

        {/* Create Program Modal */}
        <CreateProgram 
          isOpen={createModal.isOpen} 
          onClose={createModal.closeModal}
          onSuccess={handleSuccess}
        />
      </div>
    </RoleGuard>
  );
}

