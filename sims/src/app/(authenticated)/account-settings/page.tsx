"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/convex";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import Alert from "@/components/ui/alert/Alert";
import Tabs from "@/components/ui/tabs/Tabs";
import TabPane from "@/components/ui/tabs/TabPane";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import AcademicInfoCard from "@/components/user-profile/AcademicInfoCard";
import Link from 'next/link';

export default function ProfilePage() {
  const user = useCurrentUser();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Fetch profile data with student information if user is a student
  const profileData = useQuery(
    api.functions.users.getProfile,
    user?._id ? { userId: user._id } : "skip"
  );

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  // Check if user has student role
  const isStudent = user?.roles.includes("student") ?? false;

  function AlumniProfileLink({ studentId }: { studentId: string }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alumni = useQuery((api as any).alumni.getAlumniProfile, { studentId }) as {
      _id: string;
      graduationYear: number;
      contactInfo?: { email?: string; phone?: string };
    } | undefined;
    if (!alumni) return null;
    return (
      <div className="mt-4">
        <Link href={`/alumni/${alumni._id}`} className="text-sm text-brand-500 underline">View Alumni Profile</Link>
      </div>
    );
  }

  return (
    <div>
        <PageBreadCrumb pageTitle="My Profile" />

        {showSuccessMessage && (
          <div className="mb-6">
            <Alert variant="success" title="Success" message="Profile updated successfully!" />
          </div>
        )}

        <Tabs justifyTabs="left" tabStyle="independent">
          <TabPane tab="Profile Information">
            <div className="space-y-6">
              <UserMetaCard user={user} />
              <UserInfoCard user={user} onSuccess={handleSuccess} />
              {isStudent && profileData && "student" in profileData && (
                <>
                <AcademicInfoCard 
                  studentData={{
                    studentNumber: profileData.student.studentNumber,
                    admissionYear: profileData.student.admissionYear,
                    level: profileData.student.level,
                    status: profileData.student.status,
                    department: profileData.student.department ? {
                      _id: profileData.student.department._id as string,
                      name: profileData.student.department.name,
                      school: profileData.student.department.school ? {
                        _id: profileData.student.department.school._id as string,
                        name: profileData.student.department.school.name,
                      } : null,
                    } : null,
                    currentTerm: profileData.student.currentTerm ? {
                      _id: profileData.student.currentTerm._id as string,
                      name: profileData.student.currentTerm.name,
                      session: profileData.student.currentTerm.session ? {
                        _id: profileData.student.currentTerm.session._id as string,
                        label: profileData.student.currentTerm.session.yearLabel,
                      } : null,
                    } : null,
                  }} 
                />

                {/* Show link to alumni profile if graduated */}
                {profileData.student.status === 'graduated' && (
                  <AlumniProfileLink studentId={profileData.student._id} />
                )}
                </>
              )}
            </div>
          </TabPane>

          <TabPane tab="Change Password">
            <div>
              <ChangePasswordForm onSuccess={handleSuccess} />
            </div>
          </TabPane>
        </Tabs>
      </div>
  );
}

