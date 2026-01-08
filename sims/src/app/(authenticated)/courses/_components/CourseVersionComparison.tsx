'use client';

import React from 'react';
import type { CourseVersion } from './CourseVersionHistory';

type Props = {
  versionA: CourseVersion | null;
  versionB: CourseVersion | null;
};

export default function CourseVersionComparison({ versionA, versionB }: Props) {
  if (!versionA || !versionB) {
    return (
      <div className="py-6 text-sm text-gray-500 dark:text-gray-400">
        Select two versions above to compare changes. Tip: pick the current version and a previous one to see what&apos;s changed.
      </div>
    );
  }

  const titleChanged = (versionA.title || '') !== (versionB.title || '');
  const creditsChanged = (versionA.credits || 0) !== (versionB.credits || 0);
  const descChanged = (versionA.description || '').trim() !== (versionB.description || '').trim();

  const aPrereqs = new Set((versionA.prerequisites || []).map((s) => s.trim()));
  const bPrereqs = new Set((versionB.prerequisites || []).map((s) => s.trim()));
  const allPrereqs = Array.from(new Set([...(versionA.prerequisites || []), ...(versionB.prerequisites || [])]));

  return (
    <div className="border rounded-lg p-4">
      <div className="grid grid-cols-3 gap-4 items-start">
        <div className="text-sm text-gray-500">Field</div>
        <div className="text-sm text-gray-500 text-center">Version {versionA.version}</div>
        <div className="text-sm text-gray-500 text-center">Version {versionB.version}</div>

        {/* Title */}
        <div className="pt-2 text-sm text-gray-500">Title</div>
        <div className={`pt-2 ${titleChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionA.title}</div>
        <div className={`pt-2 ${titleChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionB.title}</div>

        {/* Credits */}
        <div className="pt-2 text-sm text-gray-500">Credits</div>
        <div className={`pt-2 ${creditsChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionA.credits ?? '—'}</div>
        <div className={`pt-2 ${creditsChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionB.credits ?? '—'}</div>

        {/* Description */}
        <div className="pt-2 text-sm text-gray-500">Description</div>
        <div className={`pt-2 ${descChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionA.description || '—'}</div>
        <div className={`pt-2 ${descChanged ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>{versionB.description || '—'}</div>

        {/* Prerequisites */}
        <div className="pt-2 text-sm text-gray-500">Prerequisites</div>
        <div className={`pt-2 ${allPrereqs.some((p) => !bPrereqs.has(p)) ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>
          {allPrereqs.length === 0 ? <span className="text-gray-500">None</span> : (
            <ul className="list-disc list-inside space-y-1">
              {allPrereqs.map((p) => (
                <li key={`a-${p}`} className={`${bPrereqs.has(p) ? '' : 'text-red-600 dark:text-red-400'}`}>
                  {aPrereqs.has(p) ? p : <span className="text-gray-400 line-through">{p}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`pt-2 ${allPrereqs.some((p) => !aPrereqs.has(p)) ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded p-2' : ''}`}>
          {allPrereqs.length === 0 ? <span className="text-gray-500">None</span> : (
            <ul className="list-disc list-inside space-y-1">
              {allPrereqs.map((p) => (
                <li key={`b-${p}`} className={`${aPrereqs.has(p) ? '' : 'text-green-600 dark:text-green-400'}`}>
                  {bPrereqs.has(p) ? p : <span className="text-gray-400 line-through">{p}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div />
        <div className="col-span-2 text-sm text-gray-500">Note: highlighted rows indicate differences between versions.</div>
      </div>
    </div>
  );
}
