/**
 * Transcript Mutations
 * 
 * Transactional operations for transcript management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { DatabaseWriter } from "../_generated/server";
import { NotFoundError } from "../lib/errors";
import {
  generateOfficialTranscript,
  addEnrollmentToTranscript,
} from "../lib/services/transcriptService";
import { logTranscriptGenerated } from "../lib/services/auditLogService";

/**
 * Generate an official transcript for a student
 */
export const generateTranscript = mutation({
  args: {
    studentId: v.id("students"),
    generatedByUserId: v.id("users"),
    format: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate the transcript
    const transcript = await generateOfficialTranscript(
      ctx.db,
      args.studentId,
      args.generatedByUserId,
      args.format ?? "pdf"
    );

    // Update transcript with metadata (if it was just created, it needs to be updated)
    if (transcript._id) {
      await (ctx.db as DatabaseWriter).patch(transcript._id, {
        gpa: transcript.gpa,
        metadata: transcript.metadata,
      });
    }

    // Create audit log
    await logTranscriptGenerated(
      ctx.db,
      args.generatedByUserId,
      transcript._id,
      {
        studentId: args.studentId,
        format: args.format ?? "pdf",
        gpa: transcript.gpa,
        entriesCount: transcript.entries.length,
        generatedAt: transcript.metadata?.generatedAt,
      }
    );

    return {
      success: true,
      transcriptId: transcript._id,
      gpa: transcript.gpa,
      entriesCount: transcript.entries.length,
    };
  },
});

/**
 * Add a completed enrollment to a student's transcript
 */
export const addEnrollmentToTranscriptMutation = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    enrollmentId: v.id("enrollments"),
    term: v.string(),
    year: v.number(),
    addedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Add enrollment to transcript
    await addEnrollmentToTranscript(
      ctx.db,
      args.transcriptId,
      args.enrollmentId,
      args.term,
      args.year
    );

    // Get updated transcript for audit log
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) {
      throw new NotFoundError("Transcript", args.transcriptId);
    }

    // Create audit log
    await logTranscriptGenerated(
      ctx.db,
      args.addedByUserId,
      args.transcriptId,
      {
        action: "EnrollmentAddedToTranscript",
        enrollmentId: args.enrollmentId,
        term: args.term,
        year: args.year,
        updatedGpa: transcript.gpa,
        totalEntries: transcript.entries.length,
      }
    );

    return {
      success: true,
      updatedGpa: transcript.gpa,
      totalEntries: transcript.entries.length,
    };
  },
});

