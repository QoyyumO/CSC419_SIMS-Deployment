'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api, Id } from '@/lib/convex';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';
import Loading from '@/components/loading/Loading';
import CourseVersionHistory, { type CourseVersion } from './CourseVersionHistory';
import CourseVersionComparison from './CourseVersionComparison';
import CreateCourseVersionModal from './CreateCourseVersionModal';
import Button from '@/components/ui/button/Button';
import { useAuth } from '@/hooks/useAuth';
import { isDepartmentHead } from '@/services/permissions.service';

interface CourseVersionsPageProps {
  courseId: Id<'courses'>;
}

export default function CourseVersionsPage({ courseId }: CourseVersionsPageProps) {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const userIsDepartmentHead = isDepartmentHead(roles);

  const breadcrumbItems = [
    { name: 'Course', href: '/courses' },
    { name: 'Versions' }
  ];

  const [leftVersionId, setLeftVersionId] = React.useState<string | null>(null);
  const [rightVersionId, setRightVersionId] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  function handleRetry() {
    // Remount inner query block to re-run Convex queries
    setRefreshKey((k) => k + 1);
  }

  const VersionBlock: React.FC<{ keyId: number }> = () => {
    // Keyed component to allow remount/retry
    const versions = useQuery(api.functions.courses.getVersions, courseId ? { courseId } : 'skip');

    if (versions === undefined) {
      return (
        <div className="py-12 flex items-center justify-center">
          <Loading />
        </div>
      );
    }

    const versionOptions = (versions || []).map((v: CourseVersion) => ({ id: v._id, label: `v${v.version} — ${v.title}` }));
    const left = versions?.find((v: CourseVersion) => v._id === leftVersionId) ?? null;
    const right = versions?.find((v: CourseVersion) => v._id === rightVersionId) ?? null;

    return (
      <>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Left</label>
            <select
              className="border px-3 py-2 rounded"
              value={leftVersionId ?? ''}
              onChange={(e) => setLeftVersionId(e.target.value || null)}
            >
              <option value="">Select version</option>
              {versionOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Right</label>
            <select
              className="border px-3 py-2 rounded"
              value={rightVersionId ?? ''}
              onChange={(e) => setRightVersionId(e.target.value || null)}
            >
              <option value="">Select version</option>
              {versionOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-500">Select two versions to compare changes.</div>

          <div>
            <button className="text-sm text-gray-500" onClick={() => handleRetry()}>Refresh</button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Course Versions</h2>
          {userIsDepartmentHead && courseId && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create New Version
            </Button>
          )}
        </div>

        <ComponentCard title="Course Versions">
          <CourseVersionHistory 
            versions={versions || []} 
            isLoading={false} 
            error={null} 
            onRetry={() => handleRetry()}
            onCreateVersion={userIsDepartmentHead ? () => setShowCreateModal(true) : undefined}
          />

          <div className="mt-6">
            <ComponentCard title="Compare Versions">
              <CourseVersionComparison versionA={left} versionB={right} />
            </ComponentCard>
          </div>
        </ComponentCard>
      </>
    );
  };

  const handleVersionCreated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <PageBreadCrumb items={breadcrumbItems} />

      <VersionBlock key={refreshKey} keyId={refreshKey} />

      {userIsDepartmentHead && courseId && (
        <CreateCourseVersionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleVersionCreated}
          courseId={courseId}
        />
      )}
    </div>
  );
}
