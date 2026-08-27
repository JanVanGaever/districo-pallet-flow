UPDATE public.pallets SET product_id = NULL WHERE product_id IS NOT NULL;
DELETE FROM public.products;