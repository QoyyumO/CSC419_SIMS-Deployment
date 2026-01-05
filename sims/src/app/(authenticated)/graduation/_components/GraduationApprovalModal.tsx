'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Button from '@/components/ui/button/Button';

interface GraduationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  studentInfo: {
    studentId: Id<'students'>;
    name: string;
    studentNumber: string;
  } | null;
  eligibilityResult: {
    studentId: Id<'students'>;
    eligible: boolean;
    missingRequirements: string[];
    totalCredits: number;
    requiredCredits: number;
    gpa: number;
    requiredGPA: number;
  } | null;
  isProcessing?: boolean;
}

export default function GraduationApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  studentInfo,
  eligibilityResult,
  isProcessing = false,
}: GraduationApprovalModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Approve Student Graduation
        </h2>
        {studentInfo && eligibilityResult && (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                You are about to approve graduation for this student. This action will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
                <li>Update student status to "graduated"</li>
                <li>Create a graduation record</li>
                <li>Create an alumni profile</li>
                <li>Record this action in the audit log</li>
              </ul>
            </div>

            <div className="mb-6 space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Student Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Name: </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {studentInfo.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Student Number: </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {studentInfo.studentNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Degree Audit Results
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">GPA: </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {eligibilityResult.gpa.toFixed(2)} / {eligibilityResult.requiredGPA}
                    </span>
                    {eligibilityResult.gpa >= eligibilityResult.requiredGPA && (
                      <span className="ml-2 text-green-600 dark:text-green-400">✓</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Credits: </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {eligibilityResult.totalCredits} / {eligibilityResult.requiredCredits}
                    </span>
                    {eligibilityResult.totalCredits >= eligibilityResult.requiredCredits && (
                      <span className="ml-2 text-green-600 dark:text-green-400">✓</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status: </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Eligible for Graduation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" size="md" onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={onConfirm} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Confirm Approval'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

