-- Test script to verify memory_nuggets table structure and data

-- Check if table exists
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'memory_nuggets'
ORDER BY ordinal_position;

-- Check if there's any data in the table
SELECT COUNT(*) as total_records FROM memory_nuggets;

-- Check recent records
SELECT id, user_id, model_name, content, type, category, clarity, created_at
FROM memory_nuggets 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if RLS policies are working
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'memory_nuggets';
