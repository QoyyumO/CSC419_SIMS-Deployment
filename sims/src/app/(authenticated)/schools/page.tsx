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
import SchoolsTable from './_components/SchoolsTable';
import CreateSchool from './_components/CreateSchoolForm';

type School = {
  _id: Id<'schools'>;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    email: string;
    phone: string;
  };
};

export default function SchoolsPage() {
  const createModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Fetch schools
  const schools = useQuery(api.functions.schools.list) as School[] | undefined;

  const isLoading = schools === undefined;

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  return (
    <RoleGuard role="admin" unauthorizedMessage="You must be an administrator to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Schools" />

        <div className="space-y-6">
          {showSuccessMessage && (
            <Alert variant="success" title="Success" message="School created successfully!" />
          )}

          {/* Create Button and Schools Table */}
          <ComponentCard title="Schools" desc="Manage schools in the system">
            <div className="mb-4 flex justify-end">
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createModal.openModal}
              >
                Create School
              </Button>
            </div>
            <SchoolsTable schools={schools} isLoading={isLoading} />
          </ComponentCard>
        </div>

        {/* Create School Modal */}
        <CreateSchool 
          isOpen={createModal.isOpen} 
          onClose={createModal.closeModal}
          onSuccess={handleSuccess}
        />
      </div>
    </RoleGuard>
  );
}

