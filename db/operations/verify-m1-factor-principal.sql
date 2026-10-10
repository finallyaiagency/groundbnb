-- M1-01AA rollback-only verification of the prepared 0013 factor principal boundary.
-- This reads pinned synthetic metadata only. It does not SET ROLE, execute factor functions,
-- create sessions, mutate factor state, grant privileges, or prove a live factor challenge.
-- Execute only after 0013 is separately applied on the exact approved pinned branch.
BEGIN;
DO $$
DECLARE
  e record; app_role text; factor_role text; app_oid oid; factor_oid oid; owner_oid oid;
  app_record record; factor_record record; app_functions text[]; factor_function_count integer;
  helper_oid oid; helper_owner oid; helper_config text[];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' OR
     current_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  IF app_role IS NULL OR factor_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 13 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN (
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
       '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
       '0011_membership_reader','0012_factor_service','0013_factor_service_principal')) IS DISTINCT FROM 13 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0013 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;

  SELECT * INTO STRICT app_record FROM pg_roles WHERE rolname=app_role;
  SELECT * INTO STRICT factor_record FROM pg_roles WHERE rolname=factor_role;
  app_oid:=app_record.oid; factor_oid:=factor_record.oid;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
    INTO app_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  SELECT count(*) INTO factor_function_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(factor_oid,p.oid,'EXECUTE');
  SELECT p.oid,p.proowner,p.proconfig INTO STRICT helper_oid,helper_owner,helper_config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='_factor_lock_identity' AND
      p.proargtypes='25 25 25 1184 16'::oidvector;

  IF NOT app_record.rolcanlogin OR app_record.rolsuper OR app_record.rolcreatedb OR app_record.rolcreaterole OR
     app_record.rolreplication OR app_record.rolbypassrls OR app_record.rolinherit OR
     app_record.rolconnlimit IS DISTINCT FROM 4 OR
     (app_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid OR roleid=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     app_functions IS DISTINCT FROM ARRAY[
       'groundbnb.read_membership(text,text)',
       'groundbnb.read_profile(text,text)',
       'groundbnb.read_profile_operation(text,text,uuid)',
       'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
       'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
       'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] OR
     has_function_privilege(app_oid,helper_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
         ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
          'consume_factor_recovery_candidate','read_factor_operation_receipt')
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f','S')
                    AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
                 has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
               ELSE false END OR CASE WHEN c.relkind='S' THEN
                 has_sequence_privilege(app_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) THEN
    RAISE EXCEPTION 'Ordinary application boundary differs from the six-function read-only baseline';
  END IF;

  IF factor_record.rolcanlogin IS DISTINCT FROM false OR factor_record.rolsuper OR factor_record.rolcreatedb OR
     factor_record.rolcreaterole OR factor_record.rolreplication OR factor_record.rolbypassrls OR factor_record.rolinherit OR
     factor_record.rolconnlimit IS DISTINCT FROM 2 OR factor_record.rolconfig IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=factor_oid OR roleid=factor_oid) OR
     has_database_privilege(factor_oid,current_database(),'CONNECT') IS DISTINCT FROM true OR
     has_database_privilege(factor_oid,current_database(),'CREATE') OR
     has_schema_privilege(factor_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_schema_privilege(factor_oid,'groundbnb','CREATE') OR
     factor_function_count IS DISTINCT FROM 5 OR
     has_function_privilege(factor_oid,'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)','EXECUTE') IS DISTINCT FROM true OR
     has_function_privilege(factor_oid,'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)','EXECUTE') IS DISTINCT FROM true OR
     has_function_privilege(factor_oid,'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)','EXECUTE') IS DISTINCT FROM true OR
     has_function_privilege(factor_oid,'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)','EXECUTE') IS DISTINCT FROM true OR
     has_function_privilege(factor_oid,'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)','EXECUTE') IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S')
         AND (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
                 has_table_privilege(factor_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
               ELSE false END OR CASE WHEN c.relkind='S' THEN
                 has_sequence_privilege(factor_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(factor_oid,p.oid,'EXECUTE') AND NOT (
           p.oid=to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)') OR
           p.oid=to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)'))) OR
     EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl
       WHERE c.relkind IN ('r','p','v','m','f','S') AND acl.grantee=factor_oid) OR
     EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
       WHERE acl.grantee=factor_oid AND (s.nspname<>'groundbnb' OR acl.privilege_type<>'USAGE' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_namespace s CROSS JOIN LATERAL aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
       WHERE s.nspname='groundbnb' AND acl.grantee=factor_oid) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE acl.grantee=factor_oid AND
         (acl.privilege_type<>'EXECUTE' OR acl.is_grantable OR NOT (
           p.oid=to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)') OR
           p.oid=to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)') OR
           p.oid=to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)'))) OR
     (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=factor_oid) IS DISTINCT FROM 5 OR
     EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
       WHERE d.datname=current_database() AND acl.grantee=factor_oid AND
         (acl.privilege_type<>'CONNECT' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
       WHERE d.datname=current_database() AND acl.grantee=factor_oid) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_roles WHERE oid=factor_oid AND (rolname NOT IN
       ('groundbnb_local_factor_service','groundbnb_preview_factor_service'))) THEN
    RAISE EXCEPTION 'Factor principal is not the exact passwordless function-only NOLOGIN capability';
  END IF;

  SELECT p.oid,p.proowner,p.proconfig INTO STRICT helper_oid,helper_owner,helper_config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='_factor_lock_identity' AND p.proargtypes='25 25 25 1184 16'::oidvector;
  IF helper_owner IS DISTINCT FROM owner_oid OR
     (SELECT prosecdef FROM pg_proc WHERE oid=helper_oid) IS DISTINCT FROM true OR
     helper_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
     has_function_privilege(app_oid,helper_oid,'EXECUTE') OR
     pg_get_functiondef(helper_oid) NOT ILIKE '%' || factor_role || '%' OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=helper_oid AND (acl.grantee=0 OR acl.grantee<>helper_owner OR
         acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE p.oid=helper_oid) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Private factor caller helper owner, ACL, or caller pin differs';
  END IF;
END $$;
SELECT 'M1_FACTOR_SERVICE_PRINCIPAL_0013_ROLLBACK_PENDING' AS result;
ROLLBACK;
