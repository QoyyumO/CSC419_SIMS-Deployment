'use client';

import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Button from '@/components/ui/button/Button';
import Badge from '@/components/ui/badge/Badge';
import Loading from '@/components/loading/Loading';
import { UserIcon } from '@/icons';
import { UserRole } from '../../../../../convex/lib/aggregates/types';

type User = {
  _id: Id<'users'>;
  email: string;
  roles: UserRole[];
  profile: {
    firstName: string;
    middleName?: string;
    lastName: string;
  };
  active: boolean;
};

interface UsersTableProps {
  users: User[] | undefined;
  isLoading: boolean;
}

export default function UsersTable({ users, isLoading }: UsersTableProps) {
  const toggleStatusMutation = useMutation(api.users.toggleStatus);

  const handleToggleStatus = async (userId: Id<'users'>) => {
    try {
      await toggleStatusMutation({ userId });
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <UserIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Name
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Email
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Role
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Status
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Actions
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user._id}>
              <TableCell className="px-5 py-3 text-start">
                {user.profile.firstName} {user.profile.lastName}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">{user.email}</TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge color="primary" variant="light" size="sm">
                  {user.roles.join(', ')}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Badge
                  color={user.active ? 'success' : 'light'}
                  variant="light"
                  size="sm"
                >
                  {user.active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStatus(user._id)}
                >
                  {user.active ? 'Deactivate' : 'Activate'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

