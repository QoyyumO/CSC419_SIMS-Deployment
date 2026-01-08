'use client';

import React from 'react';
import Badge from '@/components/ui/badge/Badge';
import Button from '@/components/ui/button/Button';
import Loading from '@/components/loading/Loading';
import Alert from '@/components/ui/alert/Alert';

export type CourseVersion = {
  _id: string;
  version: number;
  title: string;
  description?: string;
  credits?: number;
  prerequisites?: string[];
  isActive?: boolean;
  createdAt?: number;
};

type Props = {
  versions: CourseVersion[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onArchive?: (id: string) => void; // wired later
  onRestore?: (id: string) => void; // wired later
  onCreateVersion?: () => void; // Callback to open create version modal
};

export default function CourseVersionHistory({ versions, isLoading, error, onRetry, onArchive, onRestore, onCreateVersion }: Props) {
  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <Loading />
        <p className="text-sm text-gray-500 mt-3">Loading course versions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <Alert variant="error" title="Failed to load versions" message={error} />
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => onRetry && onRetry()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">No versions yet</p>
        <p className="text-sm">
          {onCreateVersion 
            ? 'There are no saved versions for this course. Create the first version to get started.' 
            : 'There are no saved versions for this course. Contact your department administrator.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {onCreateVersion && (
            <Button size="sm" variant="outline" onClick={onCreateVersion}>Create first version</Button>
          )}
          <Button size="sm" variant="text-only" onClick={() => onRetry && onRetry()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-8 pl-10">
        {versions.map((v) => (
          <div key={v._id} className="relative">
            <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-white border-2 border-brand-500 dark:bg-brand-500" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Version</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white/90">{v.version}</div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">{v.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{v.description}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge color={v.isActive ? 'success' : 'light'} variant="light" size="sm">
                      {v.isActive ? 'Active' : 'Archived'}
                    </Badge>

                    {v.isActive ? (
                      <Button size="sm" variant="outline" onClick={() => onArchive && onArchive(v._id)}>
                        Archive
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onRestore && onRestore(v._id)}>
                        Restore
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Created: {v.createdAt ? new Date(v.createdAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
