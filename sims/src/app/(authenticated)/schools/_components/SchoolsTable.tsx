'use client';

import React from 'react';
import { Id } from '@/lib/convex';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Loading from '@/components/loading/Loading';
import { GroupIcon } from '@/icons';

type School = {
  _id: Id<'schools'>;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    email: string;
    phone: string;
  };
};

interface SchoolsTableProps {
  schools: School[] | undefined;
  isLoading: boolean;
}

export default function SchoolsTable({ schools, isLoading }: SchoolsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!schools || schools.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <GroupIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No schools found</p>
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
              Address
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Email
            </TableCell>
            <TableCell isHeader className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400">
              Phone
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((school) => (
            <TableRow key={school._id}>
              <TableCell className="px-5 py-3 text-start font-medium">
                {school.name}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">
                {school.address.street}, {school.address.city}, {school.address.state} {school.address.postalCode}
              </TableCell>
              <TableCell className="px-5 py-3 text-start">{school.contact.email}</TableCell>
              <TableCell className="px-5 py-3 text-start">{school.contact.phone}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

