import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import AlumniProfileForm from '../_components/AlumniProfileForm';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function AlumniDetailPage({ params }: { params: { alumniId: string } }) {
  return (
    <RoleGuard roles={["admin", "registrar"]} unauthorizedMessage="You must be an administrator or registrar to access this page.">
      <div>
        <PageBreadCrumb pageTitle="Alumni Profile" />
        <AlumniDetailClient alumniId={params.alumniId} />
      </div>
    </RoleGuard>
  );
}

type AlumniProfile = {
  _id: string;
  name: string | null;
  graduationYear: number;
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  employmentStatus: string;
  currentEmployer?: string;
  jobTitle?: string;
  linkedInUrl?: string;
};

function AlumniDetailClient({ alumniId }: { alumniId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = useQuery((api as any).alumni.getAlumniById, { alumniId }) as AlumniProfile | undefined;
  const isLoading = profile === undefined;

  if (isLoading) return <div className="py-12">Loading...</div>;
  if (!profile) return <div className="py-12">Alumni profile not found</div>;

  return (
    <div className="space-y-6">
      <ComponentCard title={`${profile.name ?? 'Alumnus'} (${profile.graduationYear})`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium">Contact</h4>
            <div>{profile.contactInfo?.email}</div>
            <div className="text-sm text-gray-500">{profile.contactInfo?.phone}</div>
          </div>
          <div>
            <h4 className="font-medium">Employment</h4>
            <div>{profile.employmentStatus}</div>
            <div className="text-sm text-gray-500">{profile.currentEmployer} — {profile.jobTitle}</div>
            {profile.linkedInUrl && (
              <div><a href={profile.linkedInUrl} target="_blank" rel="noreferrer">LinkedIn profile</a></div>
            )}
          </div>
        </div>
      </ComponentCard>

      <ComponentCard title="Edit Profile">
        <AlumniProfileForm alumniId={profile._id} initial={profile} onSuccess={() => window.location.reload()} />
      </ComponentCard>
    </div>
  );
}
