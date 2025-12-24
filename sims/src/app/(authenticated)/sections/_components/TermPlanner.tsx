'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import ComponentCard from '@/components/common/ComponentCard';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import Select from '@/components/form/Select';
import Label from '@/components/form/Label';
import Checkbox from '@/components/form/input/Checkbox';
import Loading from '@/components/loading/Loading';
import { CopyIcon, PlusIcon } from '@/icons';

type Term = {
  _id: Id<'terms'>;
  name: string;
  sessionId: Id<'academicSessions'>;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

type Course = {
  _id: Id<'courses'>;
  code: string;
  title: string;
  credits: number;
};

interface TermPlannerProps {
  sessionToken: string | null;
  selectedTermId: Id<'terms'> | undefined;
  onSuccess?: () => void;
}

export default function TermPlanner({ 
  sessionToken, 
  onSuccess 
}: TermPlannerProps) {
  const [selectedTargetTermId, setSelectedTargetTermId] = useState<Id<'terms'> | undefined>(undefined);
  const [selectedSourceTermId, setSelectedSourceTermId] = useState<Id<'terms'> | undefined>(undefined);
  const [keepInstructors, setKeepInstructors] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Id<'courses'>[]>([]);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showCopyTerm, setShowCopyTerm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch terms
  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  // Fetch courses for bulk create
  const courses = useQuery(
    api.department.getDepartmentCourses,
    sessionToken ? { token: sessionToken } : 'skip'
  ) as Course[] | undefined;

  // Mutations
  const bulkCreateSections = useMutation(api.department.bulkCreateSections);
  const cloneSectionsFromTerm = useMutation(api.department.cloneSectionsFromTerm);

  // Filter terms to show only upcoming terms (startDate > now)
  // Use useState to avoid calling Date.now() during render
  const [now] = useState(() => Date.now());
  const upcomingTerms = terms?.filter((term) => term.startDate > now) || [];
  const pastTerms = terms?.filter((term) => term.endDate < now) || [];

  const handleBulkCreate = async () => {
    if (!sessionToken || !selectedTargetTermId || selectedCourseIds.length === 0) {
      setErrorMessage('Please select a term and at least one course');
      return;
    }

    try {
      setErrorMessage(null);
      await bulkCreateSections({
        token: sessionToken,
        courseIds: selectedCourseIds,
        termId: selectedTargetTermId,
        capacity: 50,
      });
      setSuccessMessage(`Successfully created ${selectedCourseIds.length} section(s)`);
      setSelectedCourseIds([]);
      setShowBulkCreate(false);
      setTimeout(() => setSuccessMessage(null), 3000);
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create sections';
      setErrorMessage(errorMessage);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleCopyTerm = async () => {
    if (!sessionToken || !selectedSourceTermId || !selectedTargetTermId) {
      setErrorMessage('Please select both source and target terms');
      return;
    }

    if (selectedSourceTermId === selectedTargetTermId) {
      setErrorMessage('Source and target terms must be different');
      return;
    }

    try {
      setErrorMessage(null);
      const result = await cloneSectionsFromTerm({
        token: sessionToken,
        sourceTermId: selectedSourceTermId,
        targetTermId: selectedTargetTermId,
        keepInstructors,
      });
      setSuccessMessage(`Successfully cloned ${result.count} section(s) from previous term`);
      setShowCopyTerm(false);
      setSelectedSourceTermId(undefined);
      setTimeout(() => setSuccessMessage(null), 3000);
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to copy sections';
      setErrorMessage(errorMessage);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleCourseToggle = (courseId: Id<'courses'>) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAllCourses = () => {
    if (courses && selectedCourseIds.length === courses.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(courses?.map((c) => c._id) || []);
    }
  };

  const sourceTermOptions = pastTerms.map((term) => ({
    value: term._id,
    label: `${term.name} (${term.sessionYearLabel})`,
  }));

  return (
    <ComponentCard title="Term Planner" desc="Bulk operations for section management">
      <div className="space-y-4">
        {successMessage && (
          <Alert variant="success" title="Success" message={successMessage} />
        )}
        {errorMessage && (
          <Alert variant="error" title="Error" message={errorMessage} />
        )}

        {/* Copy Previous Term Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Copy Previous Term</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Clone all sections from a previous term to the selected term
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              startIcon={<CopyIcon />}
              onClick={() => {
                setShowCopyTerm(!showCopyTerm);
                setShowBulkCreate(false);
              }}
            >
              {showCopyTerm ? 'Cancel' : 'Copy Previous Term'}
            </Button>
          </div>

          {showCopyTerm && (
            <div className="space-y-3 pt-3 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sourceTerm">Source Term (Previous):</Label>
                  <Select
                    options={sourceTermOptions}
                    placeholder="Select source term"
                    onChange={(e) =>
                      setSelectedSourceTermId(
                        e.target.value ? (e.target.value as Id<'terms'>) : undefined
                      )
                    }
                    defaultValue={selectedSourceTermId || ''}
                  />
                </div>
                <div>
                  <Label htmlFor="targetTerm">Target Term:</Label>
                  <Select
                    options={upcomingTerms.map((term) => ({
                      value: term._id,
                      label: `${term.name} (${term.sessionYearLabel})`,
                    }))}
                    placeholder="Select target term"
                    onChange={(e) =>
                      setSelectedTargetTermId(
                        e.target.value ? (e.target.value as Id<'terms'>) : undefined
                      )
                    }
                    defaultValue={selectedTargetTermId || ''}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="keepInstructors"
                  checked={keepInstructors}
                  onChange={(checked) => setKeepInstructors(checked)}
                />
                <Label htmlFor="keepInstructors" className="cursor-pointer">
                  Keep instructor assignments
                </Label>
              </div>
              <Button
                size="sm"
                onClick={handleCopyTerm}
                disabled={!selectedSourceTermId || !selectedTargetTermId || !sessionToken}
              >
                Copy Sections
              </Button>
            </div>
          )}
        </div>

        {/* Bulk Create Section */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Bulk Create Sections</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select multiple courses and generate sections for the selected term
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              startIcon={<PlusIcon />}
              onClick={() => {
                setShowBulkCreate(!showBulkCreate);
                setShowCopyTerm(false);
              }}
            >
              {showBulkCreate ? 'Cancel' : 'Bulk Create'}
            </Button>
          </div>

          {showBulkCreate && (
            <div className="space-y-3 pt-3 border-t">
              <div>
                <Label htmlFor="bulkTargetTerm">Target Term:</Label>
                <Select
                  options={upcomingTerms.map((term) => ({
                    value: term._id,
                    label: `${term.name} (${term.sessionYearLabel})`,
                  }))}
                  placeholder="Select target term"
                  onChange={(e) =>
                    setSelectedTargetTermId(
                      e.target.value ? (e.target.value as Id<'terms'>) : undefined
                    )
                  }
                  defaultValue={selectedTargetTermId || ''}
                />
              </div>

              {courses === undefined ? (
                <Loading />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Courses:</Label>
                    <Button
                      size="sm"
                      variant="text-only"
                      onClick={handleSelectAllCourses}
                    >
                      {selectedCourseIds.length === courses.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-2">
                    {courses.length === 0 ? (
                      <p className="text-sm text-gray-500">No courses available</p>
                    ) : (
                      courses.map((course) => (
                        <div key={course._id} className="flex items-center gap-2">
                          <Checkbox
                            id={`course-${course._id}`}
                            checked={selectedCourseIds.includes(course._id)}
                            onChange={() => handleCourseToggle(course._id)}
                          />
                          <label
                            htmlFor={`course-${course._id}`}
                            className="cursor-pointer flex-1 text-sm"
                          >
                            {course.code} - {course.title} ({course.credits} credits)
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedCourseIds.length} course(s) selected
                  </p>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleBulkCreate}
                disabled={
                  !selectedTargetTermId ||
                  selectedCourseIds.length === 0 ||
                  !sessionToken
                }
              >
                Generate Sections ({selectedCourseIds.length})
              </Button>
            </div>
          )}
        </div>
      </div>
    </ComponentCard>
  );
}

