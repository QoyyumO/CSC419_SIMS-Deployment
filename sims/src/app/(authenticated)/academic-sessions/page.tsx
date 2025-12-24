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
import SessionsTable from './_components/SessionsTable';
import TermsTable from './_components/TermsTable';
import CreateSessionForm from './_components/CreateSessionForm';
import CreateTermForm from './_components/CreateTermForm';

type AcademicSession = {
  _id: Id<'academicSessions'>;
  yearLabel: string;
  startDate: number;
  endDate: number;
};

type Term = {
  _id: Id<'terms'>;
  sessionId: Id<'academicSessions'>;
  sessionYearLabel: string;
  name: string;
  startDate: number;
  endDate: number;
};

export default function AcademicSessionsPage() {
  const createSessionModal = useModal();
  const createTermModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Fetch sessions and terms
  const sessions = useQuery(api.academicSessions.listSessions) as AcademicSession[] | undefined;
  const terms = useQuery(api.academicSessions.listTerms) as Term[] | undefined;

  const isLoading = sessions === undefined || terms === undefined;

  const handleSessionSuccess = () => {
    setSuccessMessage('Academic session created successfully!');
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    createSessionModal.closeModal();
  };

  const handleTermSuccess = () => {
    setSuccessMessage('Term created successfully!');
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    createTermModal.closeModal();
  };

  return (
    <RoleGuard role="admin" unauthorizedMessage="You must be an administrator to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Academic Sessions & Terms" />

        <div className="space-y-6">
          {showSuccessMessage && (
            <Alert variant="success" title="Success" message={successMessage} />
          )}

          {/* Academic Sessions Section */}
          <ComponentCard title="Academic Sessions" desc="Manage academic sessions in the system">
            <div className="mb-4 flex justify-end">
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createSessionModal.openModal}
              >
                Create Session
              </Button>
            </div>
            <SessionsTable sessions={sessions} isLoading={isLoading} />
          </ComponentCard>

          {/* Terms Section */}
          <ComponentCard title="Terms" desc="Manage terms within academic sessions">
            <div className="mb-4 flex justify-end">
              <Button
                size="md"
                startIcon={<PlusIcon />}
                onClick={createTermModal.openModal}
              >
                Create Term
              </Button>
            </div>
            <TermsTable terms={terms} isLoading={isLoading} />
          </ComponentCard>
        </div>

        {/* Create Session Modal */}
        <CreateSessionForm 
          isOpen={createSessionModal.isOpen} 
          onClose={createSessionModal.closeModal}
          onSuccess={handleSessionSuccess}
        />

        {/* Create Term Modal */}
        <CreateTermForm 
          isOpen={createTermModal.isOpen} 
          onClose={createTermModal.closeModal}
          onSuccess={handleTermSuccess}
          sessions={sessions}
        />
      </div>
    </RoleGuard>
  );
}

