-- Add is_featured column to welcome_backgrounds
ALTER TABLE public.welcome_backgrounds 
ADD COLUMN is_featured boolean DEFAULT false;

-- Create function to ensure only one featured background
CREATE OR REPLACE FUNCTION public.ensure_single_featured_background()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    UPDATE public.welcome_backgrounds 
    SET is_featured = false 
    WHERE id != NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER ensure_single_featured_background_trigger
BEFORE INSERT OR UPDATE ON public.welcome_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_featured_background();