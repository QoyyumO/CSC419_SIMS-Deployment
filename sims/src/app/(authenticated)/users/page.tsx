'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Input from '@/components/form/input/InputField';
import Select from '@/components/form/Select';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import { useModal } from '@/hooks/useModal';
import { PlusIcon } from '@/icons';
import { UserRole } from '../../../../convex/lib/aggregates/types';
import { RoleGuard } from '@/components/auth/RoleGuard';
import CreateUser from './_components/CreateUserForm';
import UsersTable from './_components/UsersTable';

type User = {
  _id: Id<'users'>;
  email: string;
  roles: UserRole[];
  profile: {
    firstName: string;
    middleName?: string;
    lastName: string;
  };
  active: boolean;
};

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const createModal = useModal();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Fetch users with filters
  const users = useQuery(
    api.functions.users.list,
    {
      searchTerm: searchQuery || undefined,
      roleFilter: selectedRole || undefined,
    }
  ) as User[] | undefined;

  const roleOptions: { value: string; label: string }[] = [
    { value: '', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'instructor', label: 'Instructor' },
    { value: 'student', label: 'Student' },
    { value: 'registrar', label: 'Registrar' },
    { value: 'department_head', label: 'Department Head' },
  ];

  const isLoading = users === undefined;

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  return (
    <RoleGuard role="admin" unauthorizedMessage="You must be an administrator to access this page.">
      <div>
        <PageBreadCrumb pageTitle="User Management" />

      <div className="space-y-6">
        {showSuccessMessage && (
          <Alert variant="success" title="Success" message="User created successfully!" />
        )}
        {/* Filters and Create Button */}
        <ComponentCard title="Filters">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  options={roleOptions}
                  placeholder="Filter by role"
                  defaultValue={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="md"
              startIcon={<PlusIcon />}
              onClick={createModal.openModal}
            >
              Create User
            </Button>
          </div>
        </ComponentCard>

        {/* Users Table */}
        <ComponentCard title="Users" desc="Manage system users">
          <UsersTable users={users} isLoading={isLoading} />
        </ComponentCard>
      </div>

      {/* Create User Modal */}
      <CreateUser 
        isOpen={createModal.isOpen} 
        onClose={createModal.closeModal}
        onSuccess={handleSuccess}
      />
      </div>
    </RoleGuard>
  );
}

