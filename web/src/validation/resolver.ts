import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';

/**
 * Type-safe wrapper around zodResolver for zod v4 compatibility.
 *
 * Zod v4 has slightly different type signatures from what @hookform/resolvers expects.
 * This wrapper centralizes the type bridge so individual components don't need `as never`.
 */
export function zodFormResolver<TFieldValues extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0],
): Resolver<TFieldValues> {
  // The cast is needed due to zod v4 / @hookform/resolvers type gap.
  // Centralizing here keeps all form components type-safe.
  return zodResolver(schema) as unknown as Resolver<TFieldValues>;
}
