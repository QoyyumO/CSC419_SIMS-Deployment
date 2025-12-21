"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import Alert from "@/components/ui/alert/Alert";
import Tabs from "@/components/ui/tabs/Tabs";
import TabPane from "@/components/ui/tabs/TabPane";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";

export default function ProfilePage() {
  const user = useCurrentUser();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSuccess = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

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

