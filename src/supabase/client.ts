import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wgwvxaafsigrolbhsgqe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnd3Z4YWFmc2lncm9sYmhzZ3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzA1NDksImV4cCI6MjA4MTMwNjU0OX0.D0HwuBEGdnbH1i-gpYBoo6d8tVFN0dtE2g35gXlBW6I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
