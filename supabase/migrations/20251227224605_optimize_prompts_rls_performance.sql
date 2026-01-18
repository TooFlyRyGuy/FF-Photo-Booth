/*
  # Optimize Prompts RLS Performance

  1. Changes
    - Remove redundant and slow RLS policy on prompts table
    - Keep only the simple "Public can view prompts" policy
    - The complex subquery policy was causing significant performance degradation
    - This eliminates duplicate policy evaluation and expensive subquery execution

  2. Performance Impact
    - Reduces query time by removing redundant policy evaluation
    - Eliminates expensive subquery for every row check
    - Maintains same access control (public can view all prompts)
*/

-- Drop the redundant complex policy
DROP POLICY IF EXISTS "Anyone can view global or demo tenant or own tenant prompts" ON prompts;

-- The "Public can view prompts" policy remains and provides the same access level