-- Narrow semantic-preserving repair for the installed 0011 membership reader.
-- Requalifies one PL/pgSQL variable/CTE-column collision; changes no policy,
-- data, function signature, owner, ACL, security mode, or search_path.
-- Preparation only: run under separate exact-branch operator approval.
BEGIN;
DO $$
DECLARE
  e record;
  app_role text;
  app_oid oid;
  owner_oid oid;
  role_record record;
  function_oid oid;
  original_owner oid;
  original_acl aclitem[];
  original_config text[];
  original_security_definer boolean;
  definition text;
  repaired_definition text;
  old_fragment_pattern constant text := '\(SELECT[[:space:]]+evaluated_at[[:space:]]+FROM[[:space:]]+evaluation\)';
  replacement_fragment constant text := '(SELECT e.evaluated_at FROM evaluation e)';
  matches_found integer;
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 11 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN
       ('0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
        '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
        '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
        '0011_membership_reader')) IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview migration baseline 0001-0011';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT p.oid,p.proowner,p.proacl,p.proconfig,p.prosecdef
    INTO STRICT function_oid,original_owner,original_acl,original_config,original_security_definer
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='read_membership' AND p.proargtypes='25 25'::oidvector;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f')
                 AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
           has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           ELSE false END) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND
         CASE WHEN c.relkind='S' THEN
           has_sequence_privilege(app_oid,c.oid,'USAGE') OR has_sequence_privilege(app_oid,c.oid,'SELECT') OR
           has_sequence_privilege(app_oid,c.oid,'UPDATE')
           ELSE false END) OR
     COALESCE((SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')),ARRAY[]::text[]) IS DISTINCT FROM
       ARRAY['groundbnb.read_profile(text,text)',
             'groundbnb.read_profile_operation(text,text,uuid)',
             'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
             'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
             'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] OR
     NOT original_security_definer OR original_owner IS DISTINCT FROM owner_oid OR
     NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=function_oid AND
       p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=function_oid AND (acl.grantee=0 OR acl.grantee=app_oid OR acl.grantee<>original_owner)) OR
     NOT has_function_privilege(original_owner,function_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Pinned app-role or membership-reader owner/ACL/security baseline differs';
  END IF;

  definition:=pg_get_functiondef(function_oid);
  SELECT count(*) INTO matches_found FROM regexp_matches(definition,old_fragment_pattern,'g');
  IF matches_found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected one unambiguous membership-reader evaluated_at fragment';
  END IF;
  repaired_definition:=regexp_replace(definition,old_fragment_pattern,replacement_fragment,'g');
  IF repaired_definition IS NOT DISTINCT FROM definition OR
     repaired_definition !~ '\(SELECT e\.evaluated_at FROM evaluation e\)' OR
     repaired_definition ~ old_fragment_pattern THEN
    RAISE EXCEPTION 'Membership-reader replacement did not produce the unique qualified fragment';
  END IF;

  EXECUTE repaired_definition;

  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=function_oid AND p.prosecdef=original_security_definer AND
       p.proowner=original_owner AND p.proacl IS NOT DISTINCT FROM original_acl AND
       p.proconfig IS NOT DISTINCT FROM original_config AND
       pg_get_functiondef(p.oid) ~ '\(SELECT e\.evaluated_at FROM evaluation e\)' AND
       pg_get_functiondef(p.oid) !~ old_fragment_pattern) OR
     has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=function_oid AND (acl.grantee=0 OR acl.grantee=app_oid OR acl.grantee<>original_owner)) THEN
    RAISE EXCEPTION 'Membership-reader repair changed owner, ACL, security settings, or result body unexpectedly';
  END IF;
END $$;
SELECT 'M1_MEMBERSHIP_READER_EVALUATED_AT_REPAIR_PREPARED' AS result;
COMMIT;
