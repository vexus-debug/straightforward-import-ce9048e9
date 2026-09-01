
-- Columns
ALTER TABLE public.ld_shipments
  ADD COLUMN IF NOT EXISTS rider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_url text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.ld_pickup_schedules
  ADD COLUMN IF NOT EXISTS rider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_url text;

CREATE INDEX IF NOT EXISTS idx_ld_shipments_rider ON public.ld_shipments(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_ld_pickup_schedules_rider ON public.ld_pickup_schedules(rider_user_id);

-- RLS for dispatch_rider on ld_shipments
DROP POLICY IF EXISTS "Riders can view their assigned shipments" ON public.ld_shipments;
CREATE POLICY "Riders can view their assigned shipments"
  ON public.ld_shipments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can update their assigned shipments" ON public.ld_shipments;
CREATE POLICY "Riders can update their assigned shipments"
  ON public.ld_shipments FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid());

-- RLS for dispatch_rider on ld_pickup_schedules
DROP POLICY IF EXISTS "Riders can view their assigned pickups" ON public.ld_pickup_schedules;
CREATE POLICY "Riders can view their assigned pickups"
  ON public.ld_pickup_schedules FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can update their assigned pickups" ON public.ld_pickup_schedules;
CREATE POLICY "Riders can update their assigned pickups"
  ON public.ld_pickup_schedules FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'dispatch_rider'::app_role) AND rider_user_id = auth.uid());

-- Allow riders to read clients for delivery context
DROP POLICY IF EXISTS "Riders can view ld_clients" ON public.ld_clients;
CREATE POLICY "Riders can view ld_clients"
  ON public.ld_clients FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'dispatch_rider'::app_role));

-- Storage policies for proof-of-delivery uploads in existing bucket
DROP POLICY IF EXISTS "Riders can upload proof of delivery" ON storage.objects;
CREATE POLICY "Riders can upload proof of delivery"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ld-digital-files'
    AND has_role(auth.uid(), 'dispatch_rider'::app_role)
    AND (storage.foldername(name))[1] = 'proof-of-delivery'
  );

DROP POLICY IF EXISTS "Riders can view proof of delivery" ON storage.objects;
CREATE POLICY "Riders can view proof of delivery"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ld-digital-files'
    AND (storage.foldername(name))[1] = 'proof-of-delivery'
  );
