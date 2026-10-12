-- M1-01U: grant the single private membership snapshot reader to the existing
-- environment-pinned application role after separate action-time approval.
-- No role/table/helper/factor grants or seed data are created here.
-- Preparation only; do not execute without the required browser confirmation.
BEGIN;
DO $$
DECLARE
  e record;
  app_role text;
  app_oid oid;
  owner_oid oid;
  role_record record;
  function_oid oid;
  function_owner oid;
  function_acl aclitem[];
  function_config text[];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;

  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 12 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN
       ('0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
        '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
        '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
        '0011_membership_reader','0012_factor_service')) IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview migration baseline 0001-0012';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;

  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT p.oid,p.proowner,p.proacl,p.proconfig
    INTO STRICT function_oid,function_owner,function_acl,function_config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='read_membership' AND p.proargtypes='25 25'::oidvector;

  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     NOT has_schema_privilege(app_oid,'groundbnb','USAGE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f')
                 AND c.relname NOT IN ('environment_identity','schema_migrations')) OR
              (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m','f')))
         AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
           has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           ELSE false END) OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
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
     has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     function_owner IS DISTINCT FROM owner_oid OR
     (SELECT prosecdef FROM pg_proc WHERE oid=function_oid) IS DISTINCT FROM true OR
     (function_config @> ARRAY['search_path=pg_catalog, pg_temp']) IS DISTINCT FROM true OR
     NOT has_function_privilege(owner_oid,function_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(function_acl,acldefault('f',function_owner))) acl
       WHERE p.oid=function_oid AND (acl.grantee=0 OR acl.grantee=app_oid OR acl.grantee<>function_owner
                                     OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) THEN
    RAISE EXCEPTION 'Pinned application and private membership-reader baseline differs';
  END IF;

  EXECUTE format('GRANT EXECUTE ON FUNCTION groundbnb.read_membership(text,text) TO %I',app_role);

  IF NOT has_function_privilege(app_oid,function_oid,'EXECUTE') OR
     NOT has_function_privilege(owner_oid,function_oid,'EXECUTE') OR
     function_owner IS DISTINCT FROM owner_oid OR
     (SELECT prosecdef FROM pg_proc WHERE oid=function_oid) IS DISTINCT FROM true OR
     NOT ((SELECT proconfig FROM pg_proc WHERE oid=function_oid) @> ARRAY['search_path=pg_catalog, pg_temp']) OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=function_oid AND (acl.grantee=0 OR (acl.grantee<>function_owner AND acl.grantee<>app_oid)
                                     OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) OR
     COALESCE((SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')),ARRAY[]::text[]) IS DISTINCT FROM
       ARRAY['groundbnb.read_membership(text,text)',
             'groundbnb.read_profile(text,text)',
             'groundbnb.read_profile_operation(text,text,uuid)',
             'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
             'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
             'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] THEN
    RAISE EXCEPTION 'Membership reader grant postcondition differs';
  END IF;
END $$;
SELECT 'M1_MEMBERSHIP_READER_GRANT_APPLIED' AS result;
COMMIT;
