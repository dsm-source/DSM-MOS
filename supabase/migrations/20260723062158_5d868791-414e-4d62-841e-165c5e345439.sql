ALTER TABLE public.engineering_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.engineering_jobs;