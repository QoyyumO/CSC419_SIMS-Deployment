'use client';

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Input from '@/components/form/input/InputField';
import AlumniTable from './_components/AlumniTable';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Id } from '@/lib/convex';

type AlumniRow = {
  _id: Id<'alumniProfiles'>;
  name: string | null;
  graduationYear: number;
  department?: { _id: Id<'departments'>; name: string } | null;
  employmentStatus: string;
  contactInfo: { email: string; phone: string };
};

export default function AlumniPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [graduationYear, setGraduationYear] = useState<number | undefined>(undefined);
  const { user } = useAuth();

  const alumni = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).alumni.getAllAlumni,
    {
      requesterUserId: user?._id ?? '',
      searchTerm: searchQuery || undefined,
      graduationYear: graduationYear || undefined,
    }
  ) as AlumniRow[] | undefined;

  const isLoading = alumni === undefined;

  return (
    <RoleGuard roles={["admin", "registrar"]} unauthorizedMessage="You must be an administrator or registrar to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Alumni" />

        <div className="space-y-6">
          <ComponentCard title="Filters">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Input
                    type="number"
                    placeholder="Graduation Year"
                    value={graduationYear ?? ''}
                    onChange={(e) => setGraduationYear(Number(e.target.value) || undefined)}
                  />
                </div>
              </div>
            </div>
          </ComponentCard>

          <ComponentCard title="Alumni" desc="Search and manage alumni profiles">
            <AlumniTable alumni={alumni} isLoading={isLoading} />
          </ComponentCard>
        </div>
      </div>
    </RoleGuard>
  );
}
