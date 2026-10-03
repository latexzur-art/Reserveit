-- Migration: Add missing foreign key indexes
-- This script identifies all foreign keys that do not have a supporting index
-- and creates them to improve global query performance.

DO $$ 
DECLARE
    rec RECORD;
    idx_name TEXT;
    sql_cmd TEXT;
BEGIN
    FOR rec IN 
        SELECT
            tc.table_schema, 
            tc.table_name, 
            kcu.column_name,
            c.conname
        FROM 
            information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN pg_constraint c 
            ON c.conname = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND NOT EXISTS (
            SELECT 1 
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            JOIN pg_class cls ON cls.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = cls.relnamespace
            WHERE n.nspname = tc.table_schema
            AND cls.relname = tc.table_name
            AND a.attname = kcu.column_name
        )
    LOOP
        idx_name := 'idx_' || rec.table_name || '_' || rec.column_name;
        
        -- Create index if it does not already exist with this exact name
        sql_cmd := format(
            'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I);',
            idx_name,
            rec.table_schema,
            rec.table_name,
            rec.column_name
        );
        
        RAISE NOTICE 'Executing: %', sql_cmd;
        EXECUTE sql_cmd;
    END LOOP;
END $$;
