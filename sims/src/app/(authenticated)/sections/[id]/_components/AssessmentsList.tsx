'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { TrashBinIcon, PencilIcon } from '@/icons';

type Assessment = {
  _id: Id<"assessments">;
  sectionId: Id<"sections">;
  title: string;
  weight: number;
  totalPoints: number;
  dueDate: number;
};

interface AssessmentsListProps {
  assessments: Assessment[];
  isLoading?: boolean;
  onEdit?: (assessment: Assessment) => void;
  onDelete?: (assessment: Assessment) => void;
  assessmentsWithGrades?: Set<Id<"assessments">>;
}

export default function AssessmentsList({ assessments, isLoading, onEdit, onDelete, assessmentsWithGrades = new Set() }: AssessmentsListProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateTotalWeight = () => {
    return assessments.reduce((sum, a) => sum + a.weight, 0);
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>Loading assessments...</p>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">No assessments yet</p>
        <p className="text-sm">Create your first assessment to get started</p>
      </div>
    );
  }

  const totalWeight = calculateTotalWeight();
  const hasWeightWarning = totalWeight > 100;

  return (
    <div className="space-y-4">
      {hasWeightWarning && (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20">
          <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
            Warning: Total weight is {totalWeight.toFixed(1)}%, exceeding 100%
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Title
              </TableCell>
              <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Weight
              </TableCell>
              <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Points
              </TableCell>
              <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Due Date
              </TableCell>
              {(onEdit || onDelete) && (
                <TableCell isHeader className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment) => (
              <TableRow
                key={assessment._id}
                className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <TableCell className="px-4 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                  {assessment.title}
                </TableCell>
                <TableCell className="px-4 py-4 text-sm text-gray-800 dark:text-white/90">
                  {assessment.weight}%
                </TableCell>
                <TableCell className="px-4 py-4 text-sm text-gray-800 dark:text-white/90">
                  {assessment.totalPoints}
                </TableCell>
                <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {formatDate(assessment.dueDate)}
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(assessment)}
                          disabled={assessmentsWithGrades.has(assessment._id)}
                          className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                            assessmentsWithGrades.has(assessment._id)
                              ? 'text-gray-400 cursor-not-allowed opacity-50 dark:text-gray-600'
                              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                          }`}
                          title={
                            assessmentsWithGrades.has(assessment._id)
                              ? 'Cannot edit: This assessment has grades recorded'
                              : 'Edit assessment'
                          }
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(assessment)}
                          disabled={assessmentsWithGrades.has(assessment._id)}
                          className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                            assessmentsWithGrades.has(assessment._id)
                              ? 'text-gray-400 cursor-not-allowed opacity-50 dark:text-gray-600'
                              : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                          }`}
                          title={
                            assessmentsWithGrades.has(assessment._id)
                              ? 'Cannot delete: This assessment has grades recorded'
                              : 'Delete assessment'
                          }
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Total Weight:</span>{' '}
          <span className={hasWeightWarning ? 'text-warning-600 dark:text-warning-400' : ''}>
            {totalWeight.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

