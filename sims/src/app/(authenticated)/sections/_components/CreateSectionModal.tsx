"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/lib/convex";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";

interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Course = {
  _id: Id<"courses">;
  code: string;
  title: string;
  credits: number;
};

type Term = {
  _id: Id<"terms">;
  name: string;
  sessionId: Id<"academicSessions">;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

export default function CreateSectionModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSectionModalProps) {
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });

  const [formData, setFormData] = useState({
    courseId: "",
    termId: "",
    capacity: "",
    details: "",
  });

  const [scheduleSlots, setScheduleSlots] = useState<
    Array<{
      day: string;
      startTime: string;
      endTime: string;
      room: string;
    }>
  >([]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const courseInputRef = React.useRef<HTMLDivElement>(null);

  // Fetch courses and terms
  const courses = useQuery(
    api.department.getDepartmentCourses,
    sessionToken ? { token: sessionToken } : "skip"
  ) as Course[] | undefined;

  const terms = useQuery(api.department.getTerms) as Term[] | undefined;

  const createSection = useMutation(api.department.createSection);

  // Update course search query when a course is selected
  useEffect(() => {
    if (formData.courseId && courses) {
      const selectedCourse = courses.find((c) => c._id === formData.courseId);
      if (selectedCourse) {
        setCourseSearchQuery(`${selectedCourse.code} - ${selectedCourse.title}`);
      }
    }
  }, [formData.courseId, courses]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        courseId: "",
        termId: "",
        capacity: "",
        details: "",
      });
      setScheduleSlots([]);
      setValidationErrors({});
      setApiError(null);
      setCourseSearchQuery("");
      setShowCourseDropdown(false);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        courseInputRef.current &&
        !courseInputRef.current.contains(event.target as Node)
      ) {
        setShowCourseDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.courseId) {
      errors.courseId = "Course is required";
    }

    if (!formData.termId) {
      errors.termId = "Term is required";
    }

    if (!formData.capacity) {
      errors.capacity = "Capacity is required";
    } else {
      const capacityNum = parseInt(formData.capacity, 10);
      if (isNaN(capacityNum) || capacityNum <= 0) {
        errors.capacity = "Capacity must be a positive number";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    if (!sessionToken) {
      setApiError("Session expired. Please log in again.");
      return;
    }

    setIsLoading(true);

    try {
      // Filter out incomplete schedule slots
      const validScheduleSlots = scheduleSlots.filter(
        (slot) => slot.day && slot.startTime && slot.endTime && slot.room
      );

      await createSection({
        token: sessionToken,
        courseId: formData.courseId as Id<"courses">,
        termId: formData.termId as Id<"terms">,
        capacity: parseInt(formData.capacity, 10),
        details: formData.details || undefined,
        scheduleSlots: validScheduleSlots.length > 0 ? validScheduleSlots : undefined,
      });

      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create section. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter courses based on search query
  const filteredCourses = React.useMemo(() => {
    if (!courses) return [];
    if (!courseSearchQuery.trim()) return courses;
    
    const query = courseSearchQuery.toLowerCase().trim();
    return courses.filter(
      (course) =>
        course.code.toLowerCase().includes(query) ||
        course.title.toLowerCase().includes(query)
    );
  }, [courses, courseSearchQuery]);

  const handleCourseSelect = (courseId: string, courseLabel: string) => {
    setFormData((prev) => ({ ...prev, courseId }));
    setCourseSearchQuery(courseLabel);
    setShowCourseDropdown(false);
    // Clear validation error
    if (validationErrors.courseId) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.courseId;
        return newErrors;
      });
    }
  };

  const handleCourseSearchChange = (value: string) => {
    setCourseSearchQuery(value);
    setShowCourseDropdown(true);
    // Clear course selection if search changes
    if (formData.courseId) {
      setFormData((prev) => ({ ...prev, courseId: "" }));
    }
  };

  const addScheduleSlot = () => {
    setScheduleSlots([
      ...scheduleSlots,
      { day: "", startTime: "", endTime: "", room: "" },
    ]);
  };

  const removeScheduleSlot = (index: number) => {
    setScheduleSlots(scheduleSlots.filter((_, i) => i !== index));
  };

  const updateScheduleSlot = (
    index: number,
    field: "day" | "startTime" | "endTime" | "room",
    value: string
  ) => {
    const updated = [...scheduleSlots];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleSlots(updated);
  };

  const dayOptions = [
    { value: "", label: "Select day" },
    { value: "Mon", label: "Monday" },
    { value: "Tue", label: "Tuesday" },
    { value: "Wed", label: "Wednesday" },
    { value: "Thu", label: "Thursday" },
    { value: "Fri", label: "Friday" },
    { value: "Sat", label: "Saturday" },
    { value: "Sun", label: "Sunday" },
  ];

  const termOptions =
    terms?.map((term) => ({
      value: term._id,
      label: `${term.name} (${term.sessionYearLabel})`,
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] p-6 lg:p-10"
    >
      <div className="w-full">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create New Section
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Create a new course section for your department.
          </p>
        </div>
        <div className="px-2">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {apiError && (
                <div className="mb-6">
                  <Alert variant="error" title="Error" message={apiError} />
                </div>
              )}

              <div>
                <Label htmlFor="courseId">
                  Course <span className="text-error-500">*</span>
                </Label>
                <div className="relative" ref={courseInputRef}>
                  <Input
                    id="courseId"
                    type="text"
                    placeholder="Type to search for a course (e.g., CSC 101 or Introduction)"
                    value={courseSearchQuery}
                    onChange={(e) => handleCourseSearchChange(e.target.value)}
                    onFocus={() => setShowCourseDropdown(true)}
                    error={!!validationErrors.courseId}
                    disabled={isLoading}
                  />
                  {showCourseDropdown && filteredCourses.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {filteredCourses.map((course) => {
                        const courseLabel = `${course.code} - ${course.title}`;
                        return (
                          <button
                            key={course._id}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => handleCourseSelect(course._id, courseLabel)}
                          >
                            <div className="font-medium">{course.code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {course.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {showCourseDropdown && courseSearchQuery.trim() && filteredCourses.length === 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      No courses found matching &quot;{courseSearchQuery}&quot;
                    </div>
                  )}
                </div>
                {validationErrors.courseId && (
                  <p className="text-error-500 mt-1 text-sm">
                    {validationErrors.courseId}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="termId">
                  Term <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Select
                    options={termOptions}
                    placeholder="Select a term"
                    onChange={(e) => handleInputChange("termId", e.target.value)}
                    defaultValue={formData.termId}
                    error={!!validationErrors.termId}
                    disabled={isLoading}
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
                {validationErrors.termId && (
                  <p className="text-error-500 mt-1 text-sm">
                    {validationErrors.termId}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="capacity">
                  Capacity <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="Enter capacity"
                  value={formData.capacity}
                  onChange={(e) => handleInputChange("capacity", e.target.value)}
                  error={!!validationErrors.capacity}
                  disabled={isLoading}
                  min="1"
                />
                {validationErrors.capacity && (
                  <p className="text-error-500 mt-1 text-sm">
                    {validationErrors.capacity}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="details">Details (Optional)</Label>
                <textarea
                  id="details"
                  rows={3}
                  placeholder="Enter section details (optional)"
                  value={formData.details}
                  onChange={(e) => handleInputChange("details", e.target.value)}
                  disabled={isLoading}
                  className="h-24 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>

              {/* Schedule Slots Section */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Label>
                    Schedule & Room <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addScheduleSlot}
                    disabled={isLoading}
                  >
                    + Add Schedule Slot
                  </Button>
                </div>

                {scheduleSlots.length === 0 && (
                  <p className="text-gray-500 text-sm dark:text-gray-400">
                    No schedule slots added. Click &quot;Add Schedule Slot&quot; to add one.
                  </p>
                )}

                {scheduleSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Schedule Slot {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeScheduleSlot(index)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`slot-day-${index}`}>
                          Day <span className="text-error-500">*</span>
                        </Label>
                        <div className="relative">
                          <Select
                            options={dayOptions}
                            placeholder="Select day"
                            onChange={(e) =>
                              updateScheduleSlot(index, "day", e.target.value)
                            }
                            defaultValue={slot.day}
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`slot-room-${index}`}>
                          Room <span className="text-error-500">*</span>
                        </Label>
                        <Input
                          id={`slot-room-${index}`}
                          type="text"
                          placeholder="e.g., Room 101"
                          value={slot.room}
                          onChange={(e) =>
                            updateScheduleSlot(index, "room", e.target.value)
                          }
                          disabled={isLoading}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`slot-start-${index}`}>
                          Start Time <span className="text-error-500">*</span>
                        </Label>
                        <Input
                          id={`slot-start-${index}`}
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            updateScheduleSlot(index, "startTime", e.target.value)
                          }
                          disabled={isLoading}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`slot-end-${index}`}>
                          End Time <span className="text-error-500">*</span>
                        </Label>
                        <Input
                          id={`slot-end-${index}`}
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            updateScheduleSlot(index, "endTime", e.target.value)
                          }
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex w-full items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  type="button"
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Section"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}

