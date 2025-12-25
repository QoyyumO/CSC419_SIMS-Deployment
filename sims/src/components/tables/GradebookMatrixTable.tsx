'use client';

import React from 'react';
import { Id } from '@/lib/convex';

type Assessment = {
  _id: Id<"assessments">;
  title: string;
  totalPoints: number;
  weight: number;
};

type EnrollmentGrade = {
  enrollmentId: Id<"enrollments">;
  studentId: Id<"students">;
  studentNumber: string;
  studentName: string;
  grades: Array<{
    assessmentId: Id<"assessments">;
    score: number;
    gradeId: Id<"grades">;
  }>;
};

interface GradebookMatrixTableProps {
  enrollments: EnrollmentGrade[];
  assessments: Assessment[];
  gradeValues: Map<string, string>;
  onScoreChange: (enrollmentId: Id<"enrollments">, assessmentId: Id<"assessments">, value: string) => void;
  calculateAverage: (assessmentId: Id<"assessments">) => number | null;
  calculateFinalGrade?: (enrollmentId: Id<"enrollments">) => { percentage: number; letter: string; points: number } | null;
  disabled?: boolean; // If true, disable all input fields
}

export default function GradebookMatrixTable({
  enrollments,
  assessments,
  gradeValues,
  onScoreChange,
  calculateAverage,
  calculateFinalGrade,
  disabled = false,
}: GradebookMatrixTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
              Student
            </th>
            {assessments.map((assessment) => (
              <th
                key={assessment._id}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{assessment.title}</span>
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500 mt-1">
                    / {assessment.totalPoints}
                  </span>
                </div>
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px] border-l border-gray-200 dark:border-gray-800">
              <div className="flex flex-col">
                <span className="font-semibold">Final Grade</span>
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 mt-1">
                  (Projected)
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
          {enrollments.map((enrollment) => (
            <tr
              key={enrollment.enrollmentId}
              className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 px-4 py-3 text-sm font-medium text-gray-800 dark:text-white/90 border-r border-gray-200 dark:border-gray-800">
                <div>
                  <div className="font-medium">{enrollment.studentName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {enrollment.studentNumber}
                  </div>
                </div>
              </td>
              {assessments.map((assessment) => {
                const key = `${enrollment.enrollmentId}-${assessment._id}`;
                const value = gradeValues.get(key) || '';
                const existingGrade = enrollment.grades.find((g) => g.assessmentId === assessment._id);

                return (
                  <td key={assessment._id} className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max={assessment.totalPoints}
                      step="0.01"
                      value={value}
                      onChange={(e) => onScoreChange(enrollment.enrollmentId, assessment._id, e.target.value)}
                      disabled={disabled}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                      }`}
                      placeholder={existingGrade ? existingGrade.score.toString() : '0'}
                    />
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-white dark:bg-gray-950 px-4 py-3 text-sm text-center text-gray-800 dark:text-white/90 border-l border-gray-200 dark:border-gray-800 font-medium">
                {calculateFinalGrade ? (() => {
                  const finalGrade = calculateFinalGrade(enrollment.enrollmentId);
                  if (finalGrade) {
                    return (
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{finalGrade.letter}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {finalGrade.percentage.toFixed(1)}% ({finalGrade.points.toFixed(1)})
                        </span>
                      </div>
                    );
                  }
                  return <span className="text-gray-400">—</span>;
                })() : <span className="text-gray-400">—</span>}
              </td>
            </tr>
          ))}
          {/* Average row */}
          <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
            <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-white/90 border-r border-gray-200 dark:border-gray-800">
              Class Average
            </td>
            {assessments.map((assessment) => {
              const average = calculateAverage(assessment._id);
              return (
                <td key={assessment._id} className="px-4 py-3 text-sm text-center text-gray-800 dark:text-white/90">
                  {average !== null ? average.toFixed(2) : '—'}
                </td>
              );
            })}
            <td className="sticky right-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-center text-gray-800 dark:text-white/90 border-l border-gray-200 dark:border-gray-800">
              —
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

