-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Anyone can create images for active events" ON public.generated_images;

-- Recreate it to also allow test_mode events (even if not yet active)
CREATE POLICY "Anyone can create images for active or test events"
  ON public.generated_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = generated_images.event_id
        AND (events.is_active = true OR events.test_mode = true)
    )
  );
