import React from 'react';
import Link from 'next/link';

export default function RoleCard(props: {
  id: string;
  title: string;
  description: string;
  level?: string;
  onRoleClick?: () => void;
}) {
  const onRoleClick = props.onRoleClick || (() => {});

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <Link href={`/skills/roles/${props.id}`} onClick={onRoleClick}>
        <h4 className="text-xl font-semibold text-gray-600 dark:text-white/90">
          {props.title}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {props.level}
        </p>
      </Link>

      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {props.description}
      </p>
    </div>
  );
}
