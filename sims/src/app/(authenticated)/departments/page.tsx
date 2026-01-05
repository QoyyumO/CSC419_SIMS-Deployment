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
import DepartmentsTable from './_components/DepartmentsTable';
import CreateDepartment from './_components/CreateDepartmentForm';

type Department = {
  _id: Id<'departments'>;
  name: string;
  schoolId: Id<'schools'>;
  schoolName: string;
  headId: Id<'users'>;
};

export default function DepartmentsPage() {
  const createModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Fetch departments
  const departments = useQuery(api.functions.departments.list) as Department[] | undefined;

  const isLoading = departments === undefined;

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  return (
    <RoleGuard role="admin" unauthorizedMessage="You must be an administrator to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Departments" />

        <div className="space-y-6">
          {showSuccessMessage && (
            <Alert variant="success" title="Success" message="Department created successfully!" />
          )}

          {/* Create Button and Departments Table */}
          <ComponentCard title="Departments" desc="Manage departments in the system">
            <div className="mb-4 flex justify-end">
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createModal.openModal}
              >
                Create Department
              </Button>
            </div>
            <DepartmentsTable departments={departments} isLoading={isLoading} />
          </ComponentCard>
        </div>

        {/* Create Department Modal */}
        <CreateDepartment 
          isOpen={createModal.isOpen} 
          onClose={createModal.closeModal}
          onSuccess={handleSuccess}
        />
      </div>
    </RoleGuard>
  );
}

