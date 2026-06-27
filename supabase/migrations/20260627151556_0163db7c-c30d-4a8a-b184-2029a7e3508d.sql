
CREATE POLICY "demo read pallet photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'pallet-photos');
CREATE POLICY "demo insert pallet photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'pallet-photos');
CREATE POLICY "demo update pallet photos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'pallet-photos');
CREATE POLICY "demo delete pallet photos" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'pallet-photos');
