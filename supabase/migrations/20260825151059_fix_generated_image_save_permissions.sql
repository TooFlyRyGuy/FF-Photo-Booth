/*
# Fix generated image record save permissions

## Summary
The original photo upload and AI-generated image upload both complete
successfully, but the final analytics record insert into `generated_images`
was rejected by row-level security. This migration moves that insert behind a
server-controlled function with one clear authorization check.

## 1. New Function
- Add `save_generated_image`, which accepts the event, prompt, image URLs,
  phone number, status, and error message.
- Confirm the event exists and is active or in test mode, or that the caller
  owns the event, has shared access, or is an administrator.
- Confirm the selected prompt belongs to the event.
- Store the signed-in caller in `user_id`; kiosk visitors remain supported
  with a null caller ID.
- Return the newly created generated image ID.

## 2. Generated Images Security
- Remove the direct INSERT policy from `generated_images`.
- Revoke direct INSERT privileges from public, anon, and authenticated roles.
- Grant EXECUTE on the validated function to anon and authenticated so both
  unauthenticated kiosk visitors and signed-in event owners can save records.
- Keep existing read policies unchanged.

## Important Notes
1. The storage permissions for original and generated photos are unchanged
   because those uploads are already succeeding.
2. Active public kiosk events remain writable by kiosk visitors.
3. Inactive events cannot receive records unless the caller is the owner, a
   shared user, or an administrator.
4. The function uses a fixed search path and is the only supported write path
   for generated image records.
*/

DROP POLICY IF EXISTS "Anyone can create images for active or test events" ON public.generated_images;

CREATE OR REPLACE FUNCTION public.save_generated_image(
  p_event_id uuid,
  p_prompt_id uuid,
  p_original_image_url text DEFAULT NULL,
  p_generated_image_url text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_status text DEFAULT 'processing',
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_image_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF p_status NOT IN ('processing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid image status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = p_event_id
      AND (
        e.is_active = true
        OR e.test_mode = true
        OR e.user_id = v_user_id
        OR e.created_by = v_user_id
        OR EXISTS (
          SELECT 1
          FROM event_access ea
          WHERE ea.event_id = e.id
            AND ea.user_id = v_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM user_profiles up
          WHERE up.id = v_user_id
            AND up.role = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Event is not available for image saving';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM event_prompts ep
    WHERE ep.event_id = p_event_id
      AND ep.prompt_id = p_prompt_id
  ) THEN
    RAISE EXCEPTION 'Prompt is not assigned to this event';
  END IF;

  INSERT INTO generated_images (
    event_id,
    prompt_id,
    original_image_url,
    generated_image_url,
    phone_number,
    status,
    error_message,
    user_id
  )
  VALUES (
    p_event_id,
    p_prompt_id,
    p_original_image_url,
    p_generated_image_url,
    p_phone_number,
    p_status,
    p_error_message,
    v_user_id
  )
  RETURNING id INTO v_image_id;

  RETURN v_image_id;
END;
$$;

REVOKE INSERT ON public.generated_images FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_generated_image(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_generated_image(uuid, uuid, text, text, text, text, text) TO anon, authenticated;
