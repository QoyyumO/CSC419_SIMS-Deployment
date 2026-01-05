'use client';

import React from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function GraduationPage() {
  return (
    <RoleGuard 
      roles={["admin", "registrar", "department_head"]} 
      unauthorizedMessage="You must be an administrator, registrar, or department head to access this page."
    >
      <div>
        <PageBreadCrumb pageTitle="Graduation Management" />

        <div className="space-y-6">
          <ComponentCard title="Graduation Management" desc="Process and approve student graduations">
            <div className="p-4">
              <p className="text-gray-600 dark:text-gray-400">
                Graduation management interface will be implemented here.
              </p>
            </div>
          </ComponentCard>
        </div>
      </div>
    </RoleGuard>
  );
}

