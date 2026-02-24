-- ============================================
-- FIX: Allow all authenticated users to share data
-- Run this in Supabase SQL Editor AFTER the previous migration
-- ============================================

-- Drop old per-user policies
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.trucks;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.app_users;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.fuelings;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.freights;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.fines;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.truck_expenses;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.driver_expenses;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.driver_bonuses;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.driver_discounts;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.closings;
DROP POLICY IF EXISTS "Users can CRUD their own data" ON public.settings;

-- Create new policies: all authenticated users can read/write all data
CREATE POLICY "Authenticated users full access" ON public.trucks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.app_users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.fuelings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.freights FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.fines FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.truck_expenses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.driver_expenses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.driver_bonuses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.driver_discounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.closings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
