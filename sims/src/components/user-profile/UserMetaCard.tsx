'use client';
import React from 'react';
import AvatarText from '../ui/avatar/AvatarText';
import { User } from '@/context/AuthContext';

interface UserMetaCardProps {
  user: User | null;
}

export default function UserMetaCard({ user }: UserMetaCardProps) {
  if (!user) return null;

  const fullName = `${user.profile.firstName}${user.profile.middleName ? ` ${user.profile.middleName}` : ''} ${user.profile.lastName}`.trim();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
            <AvatarText
              className="h-20 w-20"
              name={fullName}
            />
          </div>
          <div className="order-3 xl:order-2">
            <h4 className="mb-2 text-center text-lg font-semibold text-gray-800 xl:text-left dark:text-white/90">
              {fullName}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
