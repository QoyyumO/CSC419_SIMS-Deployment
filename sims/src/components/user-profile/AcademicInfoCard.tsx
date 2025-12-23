'use client';
import React from 'react';
import Badge from '../ui/badge/Badge';

interface AcademicInfoCardProps {
  studentData: {
    studentNumber: string;
    admissionYear: number;
    level: string;
    status: string;
    department: {
      _id: string;
      name: string;
      school: {
        _id: string;
        name: string;
      } | null;
    } | null;
    currentTerm: {
      _id: string;
      name: string;
      session: {
        _id: string;
        label: string;
      } | null;
    } | null;
  };
}

export default function AcademicInfoCard({ studentData }: AcademicInfoCardProps) {
  // Map status to badge color
  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'error';
      case 'graduated':
        return 'info';
      case 'inactive':
        return 'warning';
      default:
        return 'info';
    }
  };

  // Format status for display
  const formatStatus = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800">
      <div>
        <h4 className="text-lg font-semibold text-gray-800 lg:mb-6 dark:text-white/90">
          Academic Information
        </h4>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Department
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {studentData.department?.name || '-'}
            </p>
            {studentData.department?.school?.name && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {studentData.department.school.name}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Enrollment Status
            </p>
            <div>
              <Badge
                size="sm"
                color={getStatusColor(studentData.status)}
                variant="light"
              >
                {formatStatus(studentData.status)}
              </Badge>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Current Term/Year
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {studentData.currentTerm?.name || '-'}
            </p>
            {studentData.currentTerm?.session?.label && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {studentData.currentTerm.session.label}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Student Number
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {studentData.studentNumber || '-'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Level
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {studentData.level || '-'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              Admission Year
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {studentData.admissionYear || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

