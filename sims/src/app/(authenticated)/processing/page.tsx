'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/../convex/_generated/dataModel';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/Alert';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import Select from '@/components/form/Select';
import Button from '@/components/ui/button/Button';
import { useHasRole } from '@/hooks/useHasRole';
import MetricCard from '@/components/common/MetricCard';

type Term = {
  _id: Id<"terms">;
  name: string;
  sessionId: Id<"academicSessions">;
  sessionYearLabel: string;
  startDate: number;
  endDate: number;
};

type ProcessingResult = {
  success: boolean;
  termName: string;
  studentsProcessed: number;
  standingCounts: {
    "First Class": number;
    "Second Class (Upper Division)": number;
    "Second Class (Lower Division)": number;
    "Third Class": number;
    "Probation": number;
  };
};

export default function ProcessingPage() {
  const isRegistrar = useHasRole('registrar');

  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch terms
  const terms = useQuery(api.academicSessions.listTerms) as Term[] | undefined;

  // Process term end mutation
  const processTermEnd = useMutation(api.registrar.processTermEnd);

  // Term options for dropdown
  const termOptions =
    terms?.map((term) => ({
      value: term._id,
      label: `${term.name} (${term.sessionYearLabel})`,
    })) || [];

  const handleProcessTerm = async () => {
    if (!selectedTermId) {
      setError('Please select a term');
      return;
    }

    if (!sessionToken) {
      setError('Session token not found');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingResult(null);

    try {
      const result = await processTermEnd({
        token: sessionToken,
        termId: selectedTermId as Id<"terms">,
      });

      setProcessingResult(result);
    } catch (err) {
      let errorMessage = 'An error occurred while processing the term';
      
      if (err instanceof Error) {
        const rawMessage = err.message;
        
        // Extract user-friendly message from Convex error format
        // Look for "Cannot process term end:" which is the start of the user-friendly message
        const userMessageMatch = rawMessage.match(/Cannot process term end:([^]*?)(?:\s+at\s|$)/);
        if (userMessageMatch) {
          errorMessage = `Cannot process term end:${userMessageMatch[1].trim()}`;
        } else {
          // Fallback: Remove technical prefixes and stack traces
          let cleanedMessage = rawMessage
            .replace(/\[CONVEX[^\]]+\]\s*/g, '')
            .replace(/\[Request ID:[^\]]+\]\s*/g, '')
            .replace(/Server Error\s*/g, '')
            .replace(/Uncaught Error:\s*/g, '')
            .replace(/\s*at handler[^]*$/g, '')
            .replace(/\s*Called by client[^]*$/g, '')
            .trim();
          
          if (cleanedMessage.length > 0) {
            errorMessage = cleanedMessage;
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isRegistrar) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageBreadCrumb items={[{ name: 'Term End Processing' }]} />
        <Alert
          variant="error"
          title="Access Denied"
          message="You do not have permission to access this page. Registrar role required."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadCrumb items={[{ name: 'Term End Processing' }]} />

      <div className="mt-6">
        <h1 className="text-3xl font-bold mb-6">Term End Processing</h1>

        {/* Term End Processing Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Calculate Academic Standing</h2>
          <p className="text-gray-600 mb-4">
            This operation will calculate academic standing for all students active in the selected term
            and lock all sections for that term. This is a heavy operation and should be performed at the end of a term.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Term
            </label>
            <Select
              defaultValue={selectedTermId}
              onChange={(e) => {
                setSelectedTermId(e.target.value);
                setProcessingResult(null);
                setError(null);
              }}
              options={[
                { value: '', label: 'Select a term...' },
                ...termOptions,
              ]}
              placeholder="Select a term..."
            />
          </div>

          <Button
            onClick={handleProcessTerm}
            disabled={!selectedTermId || isProcessing}
            variant="warning"
            className="w-full sm:w-auto"
          >
            {isProcessing ? 'Processing...' : 'Calculate Academic Standing'}
          </Button>

          {error && (
            <Alert
              variant="error"
              title="Error"
              message={error}
              className="mt-4"
            />
          )}
        </div>

        {/* Report Preview */}
        {processingResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Processing Report</h2>
            <p className="text-gray-600 mb-4">
              Term: <strong>{processingResult.termName}</strong>
            </p>
            <p className="text-gray-600 mb-6">
              Students Processed: <strong>{processingResult.studentsProcessed}</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <MetricCard
                title="First Class"
                value={processingResult.standingCounts["First Class"]}
                description="GPA ≥ 4.5"
              />
              <MetricCard
                title="Second Class (Upper Division)"
                value={processingResult.standingCounts["Second Class (Upper Division)"]}
                description="GPA 3.5 - 4.49"
              />
              <MetricCard
                title="Second Class (Lower Division)"
                value={processingResult.standingCounts["Second Class (Lower Division)"]}
                description="GPA 2.4 - 3.49"
              />
              <MetricCard
                title="Third Class"
                value={processingResult.standingCounts["Third Class"]}
                description="GPA 1.5 - 2.39"
              />
              <MetricCard
                title="Probation"
                value={processingResult.standingCounts["Probation"]}
                description="GPA < 1.5"
              />
            </div>

            <div className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-semibold">Academic Standing</TableCell>
                    <TableCell className="font-semibold">Count</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>First Class</TableCell>
                    <TableCell>{processingResult.standingCounts["First Class"]}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Second Class (Upper Division)</TableCell>
                    <TableCell>{processingResult.standingCounts["Second Class (Upper Division)"]}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Second Class (Lower Division)</TableCell>
                    <TableCell>{processingResult.standingCounts["Second Class (Lower Division)"]}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Third Class</TableCell>
                    <TableCell>{processingResult.standingCounts["Third Class"]}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Probation</TableCell>
                    <TableCell>{processingResult.standingCounts["Probation"]}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

