'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import Select from '@/components/form/Select';
import { Modal } from '@/components/ui/modal';
import Button from '@/components/ui/button/Button';
import { FileIcon, AlertIcon, TrashBinIcon } from '@/icons';

type Section = {
  _id: Id<'sections'>;
  courseCode: string;
  courseTitle: string;
  sectionId: Id<'sections'>;
  instructorId: Id<'users'> | null;
  instructorName: string;
  capacity: number;
  enrollmentCount: number;
  status: string;
  termId: Id<'terms'>;
  termName: string;
  sessionYearLabel: string;
  isOpenForEnrollment: boolean;
};

type Instructor = {
  _id: Id<'users'>;
  name: string;
  email: string;
};

interface SectionsTableProps {
  sections: Section[] | undefined;
  isLoading: boolean;
  sessionToken: string | null;
  selectedTermId: Id<'terms'> | undefined;
  onAssignmentChange?: () => void;
  onSectionDeleted?: () => void;
}

export default function SectionsTable({ 
  sections, 
  isLoading, 
  sessionToken,
  onAssignmentChange,
  onSectionDeleted
}: SectionsTableProps) {
  const [assigningSectionId, setAssigningSectionId] = useState<Id<'sections'> | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<Id<'sections'> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);

  // Fetch department instructors
  const instructors = useQuery(
    api.department.getDepartmentInstructors,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as Instructor[] | undefined;

  const assignInstructor = useMutation(api.department.assignInstructor);
  const removeInstructor = useMutation(api.department.removeInstructor);
  const deleteSection = useMutation(api.department.deleteSection);

  const handleInstructorChange = async (
    sectionId: Id<'sections'>,
    instructorId: string
  ) => {
    if (!sessionToken) return;

    setAssigningSectionId(sectionId);

    try {
      if (instructorId === '') {
        // Remove instructor
        await removeInstructor({
          token: sessionToken,
          sectionId,
        });
      } else {
        // Assign instructor
        await assignInstructor({
          token: sessionToken,
          sectionId,
          instructorId: instructorId as Id<'users'>,
        });
      }
      // Notify parent component of successful assignment change
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (error) {
      console.error('Failed to assign instructor:', error);
    } finally {
      setAssigningSectionId(null);
    }
  };

  const handleDeleteClick = (section: Section) => {
    setSectionToDelete(section);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToken || !sectionToDelete) return;

    setDeletingSectionId(sectionToDelete._id);

    try {
      await deleteSection({
        token: sessionToken,
        sectionId: sectionToDelete._id,
      });
      setDeleteConfirmOpen(false);
      setSectionToDelete(null);
      if (onSectionDeleted) {
        onSectionDeleted();
      }
    } catch (error) {
      console.error('Failed to delete section:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete section';
      alert(errorMessage);
    } finally {
      setDeletingSectionId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setSectionToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <FileIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No sections found</p>
        <p className="mt-2 text-sm">Try selecting a different term or create a new section</p>
      </div>
    );
  }

  const instructorOptions = [
    { value: '', label: 'Unassigned' },
    ...(instructors?.map((instructor) => ({
      value: instructor._id,
      label: instructor.name,
    })) || []),
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Course Code
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Course Title
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Instructor
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Capacity
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Assignment Status
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Publication Status
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Term / Session
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Actions
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((section) => {
            const isUnassigned = section.status === 'Unassigned';
            const isAssigning = assigningSectionId === section._id;

            return (
              <TableRow
                key={section._id}
                className={`${
                  isUnassigned
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                    : ''
                } ${isAssigning ? 'opacity-50' : ''}`}
              >
                <TableCell className="px-5 py-3 text-start font-medium">
                  <div className="flex items-center gap-2">
                    {isUnassigned && (
                      <AlertIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    )}
                    {section.courseCode}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  {section.courseTitle}
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <div className="relative w-full min-w-[180px]">
                    <Select
                      options={instructorOptions}
                      placeholder="Select instructor"
                      onChange={(e) => handleInstructorChange(section._id, e.target.value)}
                      defaultValue={section.instructorId || ''}
                      disabled={isAssigning || !sessionToken}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  {section.enrollmentCount} / {section.capacity}
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      section.status === "Active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}
                  >
                    {section.status}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      section.isOpenForEnrollment
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                    }`}
                  >
                    {section.isOpenForEnrollment ? "Published" : "Draft"}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-3 text-start text-sm text-gray-600 dark:text-gray-400">
                  {section.termName} / {section.sessionYearLabel}
                </TableCell>
                <TableCell className="px-5 py-3 text-start">
                  <button
                    onClick={() => handleDeleteClick(section)}
                    disabled={deletingSectionId === section._id || !sessionToken}
                    className="flex items-center justify-center rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-400 dark:hover:bg-red-900/20"
                    title="Delete section"
                  >
                    <TrashBinIcon className="h-5 w-5" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        className="max-w-[500px] p-6"
      >
        <div>
          <h4 className="text-title-sm mb-4 font-semibold text-gray-800 dark:text-white/90">
            Delete Section
          </h4>
          <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this section?
          </p>
          {sectionToDelete && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {sectionToDelete.courseCode} - {sectionToDelete.courseTitle}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {sectionToDelete.termName} / {sectionToDelete.sessionYearLabel}
              </p>
              {sectionToDelete.enrollmentCount > 0 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Warning: This section has {sectionToDelete.enrollmentCount} enrollment(s). 
                  You cannot delete sections with enrollments.
                </p>
              )}
            </div>
          )}
          <div className="mt-6 flex w-full items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deletingSectionId !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteConfirm}
              disabled={deletingSectionId !== null || (sectionToDelete?.enrollmentCount ?? 0) > 0}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingSectionId ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
