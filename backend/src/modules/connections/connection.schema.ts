import { z } from 'zod';

export const requestConnectionSchema = z.object({
  userId: z.string().uuid('Provide the UUID of the person to connect with.'),
});

export const respondConnectionSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel'], {
    errorMap: () => ({ message: 'Action must be accept, decline, or cancel.' }),
  }),
});

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first.')
    .max(2000, 'Messages are limited to 2000 characters.'),
});

export type RequestConnectionInput = z.infer<typeof requestConnectionSchema>;
export type RespondConnectionInput = z.infer<typeof respondConnectionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
