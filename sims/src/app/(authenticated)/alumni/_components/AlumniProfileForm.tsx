'use client';

import React, { useState } from 'react';
import Input from '@/components/form/input/InputField';
import Button from '@/components/ui/button/Button';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  alumniId: string;
  initial?: any;
  onSuccess?: () => void;
}

export default function AlumniProfileForm({ alumniId, initial, onSuccess }: Props) {
  const [email, setEmail] = useState(initial?.contactInfo?.email ?? '');
  const [phone, setPhone] = useState(initial?.contactInfo?.phone ?? '');
  const [street, setStreet] = useState(initial?.contactInfo?.address?.street ?? '');
  const [city, setCity] = useState(initial?.contactInfo?.address?.city ?? '');
  const [state, setState] = useState(initial?.contactInfo?.address?.state ?? '');
  const [postalCode, setPostalCode] = useState(initial?.contactInfo?.address?.postalCode ?? '');
  const [country, setCountry] = useState(initial?.contactInfo?.address?.country ?? '');
  const [employmentStatus, setEmploymentStatus] = useState(initial?.employmentStatus ?? 'unknown');
  const [currentEmployer, setCurrentEmployer] = useState(initial?.currentEmployer ?? '');
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? '');
  const [linkedInUrl, setLinkedInUrl] = useState(initial?.linkedInUrl ?? '');
  const [loading, setLoading] = useState(false);

  const updateMutation = useMutation((api as any).alumni.updateAlumniProfile);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email || !email.includes('@')) {
      alert('Please provide a valid email');
      return;
    }

    setLoading(true);
    try {
      await updateMutation({ requesterUserId: user?._id ?? '', alumniId, updates: {
        contactInfo: { email, phone, address: { street, city, state, postalCode, country } },
        employmentStatus,
        currentEmployer,
        jobTitle,
        linkedInUrl,
      }} as any);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error updating alumni profile', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Street" value={street} onChange={(e) => setStreet(e.target.value)} />
        <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <Input placeholder="Postal Code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input placeholder="Employment Status" value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)} />
        <Input placeholder="Current Employer" value={currentEmployer} onChange={(e) => setCurrentEmployer(e.target.value)} />
        <Input placeholder="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        <Input placeholder="LinkedIn URL" value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} />
      </div>
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}
