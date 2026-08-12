import { z } from 'zod';

export const updateUserMediaSchema = z.object({
  status: z.enum(['watched', 'unwatched', 'watch_later']),
  review_status: z.enum(['none', 'pending', 'written']).optional(),
});

export const reviewLaterSchema = z.object({
  media_id: z.string().uuid(),
});

export const watchLaterSchema = z.object({
  media_id: z.string().uuid(),
});

export const createReviewSchema = z.object({
  media_id: z.string().uuid(),
  body: z.string().min(1).max(10000),
  is_spoiler: z.boolean().optional().default(false),
  visibility: z.enum(['public', 'friends', 'private']).optional().default('friends'),
});

export const updateReviewSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  is_spoiler: z.boolean().optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
});

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Username: lowercase letters, numbers, underscores only');

export const authCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6).max(72),
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  avatar_url: z.string().url().nullable().optional(),
  profile_visibility: z.enum(['public', 'friends', 'private']).optional(),
  collection_visibility: z.enum(['public', 'friends', 'private']).optional(),
  reviews_visibility: z.enum(['public', 'friends', 'private']).optional(),
});

export const filterPresetSchema = z.object({
  name: z.string().min(1).max(50),
  filter_config: z.record(z.array(z.string())),
});

export const friendRequestSchema = z.object({
  username: z.string().optional(),
  user_id: z.string().uuid().optional(),
});

export const recommendationSchema = z.object({
  receiver_id: z.string().uuid(),
  media_id: z.string().uuid(),
  message: z.string().max(500).optional(),
});

export const undoSchema = z.object({
  media_id: z.string().uuid(),
  previous_status: z.enum(['watched', 'unwatched', 'watch_later']),
  previous_review_status: z.enum(['none', 'pending', 'written']),
});

export const importSchema = z.object({
  export_version: z.literal(1),
  exported_at: z.string(),
  media: z.array(
    z.object({
      provider: z.string(),
      provider_id: z.string(),
      title: z.string(),
      format: z.string(),
      classification: z.string(),
      status: z.enum(['watched', 'unwatched', 'watch_later']),
      review_status: z.enum(['none', 'pending', 'written']),
      watched_at: z.string().nullable(),
      review: z
        .object({
          body: z.string(),
          is_spoiler: z.boolean(),
        })
        .nullable(),
    }),
  ),
});

export type UpdateUserMediaInput = z.infer<typeof updateUserMediaSchema>;
export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type ImportInput = z.infer<typeof importSchema>;
export type AuthCredentialsInput = z.infer<typeof authCredentialsSchema>;
