import { z } from 'zod';
import { ContentKindSchema, PlatformSchema } from './channel';
import { NewsItemSchema } from './trend';

export const StageStateSchema = z.object({
  status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  outputs: z.array(z.string()).default([]),
  meta: z.record(z.string(), z.unknown()).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional()
});
export type StageState = z.infer<typeof StageStateSchema>;

export const PackageStatusSchema = z.enum([
  'rendered',
  'packaged',
  'pending_approval',
  'approved',
  'rejected',
  'published'
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

/** Allowed status transitions for content packages. */
export const PACKAGE_TRANSITIONS: Record<string, string[]> = {
  rendered: ['packaged'],
  packaged: ['pending_approval', 'approved'],
  pending_approval: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  rejected: [],
  published: []
};

export const PackageEntrySchema = z.object({
  pkgId: z.string(),
  channelId: z.string(),
  kind: ContentKindSchema,
  platforms: z.array(PlatformSchema),
  status: PackageStatusSchema,
  approval: z
    .object({
      mode: z.enum(['auto', 'manual']),
      by: z.string(),
      at: z.string(),
      note: z.string().optional()
    })
    .optional(),
  dir: z.string(),
  zip: z.string().optional(),
  publish: z
    .object({
      publisher: z.string(),
      results: z.record(
        z.string(),
        z.object({
          ok: z.boolean(),
          remoteId: z.string().optional(),
          remoteUrl: z.string().optional(),
          publishedAt: z.string().optional(),
          error: z.string().optional()
        })
      )
    })
    .default({ publisher: 'manual', results: {} })
});
export type PackageEntry = z.infer<typeof PackageEntrySchema>;

export const ChannelRunSchema = z.object({
  status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  error: z.string().optional(),
  topic: z
    .object({
      title: z.string(),
      score: z.number(),
      whyNow: z.string(),
      sources: z.array(NewsItemSchema)
    })
    .optional(),
  plan: z
    .array(z.object({ kind: ContentKindSchema, topicRank: z.number(), pkgId: z.string().optional() }))
    .default([]),
  stages: z.record(z.string(), StageStateSchema).default({})
});
export type ChannelRun = z.infer<typeof ChannelRunSchema>;

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  status: z.enum(['running', 'completed', 'completed_with_errors', 'failed']),
  mock: z.boolean().default(false),
  trends: z
    .record(
      z.string(),
      z.object({
        status: z.enum(['pending', 'done', 'failed']),
        file: z.string().optional(),
        count: z.number().optional(),
        stale: z.boolean().optional(),
        error: z.string().optional()
      })
    )
    .default({}),
  channels: z.record(z.string(), ChannelRunSchema).default({}),
  packages: z.record(z.string(), PackageEntrySchema).default({})
});
export type Manifest = z.infer<typeof ManifestSchema>;
