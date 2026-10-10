-- M1-01AA dormant factor service capability roles and exact caller pin.
-- Roles start NOLOGIN. This migration creates no credentials and activates no route.
BEGIN;
DO $$
DECLARE e record; app_role text; factor_role text; app_oid oid; owner_oid oid;
  role_record record; helper_oid oid; helper_owner oid; helper_acl aclitem[]; helper_config text[];
  receipt_count integer; callable_functions text[];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' OR
     current_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR factor_role IS NULL OR receipt_count IS DISTINCT FROM 12 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader','0012_factor_service'
     ]::text[])) IS DISTINCT FROM 12 OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0013_factor_service_principal') OR
     EXISTS(SELECT 1 FROM pg_roles WHERE rolname=factor_role) THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0012 baseline and absent factor principal';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE oid=app_oid;
  SELECT p.oid,p.proowner,p.proacl,p.proconfig
    INTO STRICT helper_oid,helper_owner,helper_acl,helper_config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='_factor_lock_identity' AND
      p.proargtypes='25 25 25 1184 16'::oidvector;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
    INTO callable_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid OR roleid=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     callable_functions IS DISTINCT FROM ARRAY[
       'groundbnb.read_membership(text,text)',
       'groundbnb.read_profile(text,text)',
       'groundbnb.read_profile_operation(text,text,uuid)',
       'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
       'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
       'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] OR
     has_function_privilege(app_oid,helper_oid,'EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f') AND
                 c.relname NOT IN ('environment_identity','schema_migrations')) OR
              (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m','f')))
         AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
           has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind='S' AND
         (has_sequence_privilege(app_oid,c.oid,'USAGE') OR has_sequence_privilege(app_oid,c.oid,'SELECT') OR
          has_sequence_privilege(app_oid,c.oid,'UPDATE'))) OR
     helper_owner IS DISTINCT FROM owner_oid OR
     (SELECT prosecdef FROM pg_proc WHERE oid=helper_oid) IS DISTINCT FROM true OR
     helper_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(helper_acl,acldefault('f',helper_owner))) acl
       WHERE p.oid=helper_oid AND (acl.grantee=0 OR acl.grantee<>helper_owner OR
         acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(helper_acl,acldefault('f',helper_owner))) acl WHERE p.oid=helper_oid) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Pinned ordinary app boundary or private factor-helper baseline differs';
  END IF;

  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
         'consume_factor_recovery_candidate','read_factor_operation_receipt')
        AND (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_oid,p.oid,'EXECUTE') OR EXISTS(
            SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR (acl.grantee<>p.proowner) OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
         'consume_factor_recovery_candidate','read_factor_operation_receipt')) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Exact private 0012 factor-function owner, ACL, or SECURITY DEFINER contract differs';
  END IF;

  EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2',factor_role);
  EXECUTE format('GRANT CONNECT ON DATABASE groundbnb TO %I',factor_role);
  EXECUTE format('GRANT USAGE ON SCHEMA groundbnb TO %I',factor_role);
  EXECUTE format('GRANT EXECUTE ON FUNCTION
    groundbnb.read_factor_challenge_state(text,text,text,timestamptz),
    groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer),
    groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer),
    groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer),
    groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text) TO %I',factor_role);

  EXECUTE $ddl$CREATE OR REPLACE FUNCTION groundbnb._factor_lock_identity(
    p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,p_lock_rows boolean
  ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $factor$
  DECLARE e record; expected_role text; expected_factor_role text; expected_issuer text;
    session_expiry timestamptz; account_uuid uuid;
  BEGIN
    SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
    expected_role:=CASE
      WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
      WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
    expected_factor_role:=CASE
      WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
      WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
    expected_issuer:=CASE e.kind
      WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
      WHEN 'preview' THEN 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
    IF expected_role IS NULL OR expected_factor_role IS NULL OR
       session_user NOT IN (expected_role,expected_factor_role,'neondb_owner') OR
       p_issuer IS DISTINCT FROM expected_issuer OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 200 OR
       p_session_id IS NULL OR length(p_session_id) NOT BETWEEN 1 AND 200 OR
       p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
       p_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
       p_session_expires_at IS NULL OR NOT isfinite(p_session_expires_at) THEN RETURN NULL; END IF;
    IF p_lock_rows THEN
      SELECT s."expiresAt" INTO session_expiry FROM neon_auth.session s
        WHERE s.id=p_session_id::uuid AND s."userId"=p_subject::uuid FOR UPDATE OF s;
    ELSE
      SELECT s."expiresAt" INTO session_expiry FROM neon_auth.session s
        WHERE s.id=p_session_id::uuid AND s."userId"=p_subject::uuid;
    END IF;
    IF NOT FOUND OR session_expiry IS NULL OR NOT isfinite(session_expiry) OR
       session_expiry<=clock_timestamp() OR p_session_expires_at<=clock_timestamp() OR
       session_expiry<p_session_expires_at THEN RETURN NULL; END IF;
    IF p_lock_rows THEN
      SELECT a.id INTO account_uuid FROM groundbnb.account_identities i
        JOIN groundbnb.accounts a ON a.id=i.account_id
        WHERE i.issuer=p_issuer AND i.subject=p_subject AND i.revoked_at IS NULL AND a.status='active'
          AND a.role IN ('owner','admin') FOR UPDATE OF a,i;
    ELSE
      SELECT a.id INTO account_uuid FROM groundbnb.account_identities i
        JOIN groundbnb.accounts a ON a.id=i.account_id
        WHERE i.issuer=p_issuer AND i.subject=p_subject AND i.revoked_at IS NULL AND a.status='active'
          AND a.role IN ('owner','admin');
    END IF;
    IF NOT FOUND THEN RETURN NULL; END IF;
    RETURN account_uuid;
  END $factor$ $ddl$;

  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=factor_role;
  IF role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 2 OR role_record.rolconfig IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid OR roleid=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CONNECT') IS DISTINCT FROM true OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR
     has_schema_privilege(role_record.oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f','S')) OR
              (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m','f','S')))
         AND (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
                has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              ELSE false END OR CASE WHEN c.relkind='S' THEN
                has_sequence_privilege(role_record.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(role_record.oid,p.oid,'EXECUTE') AND NOT (
           (p.proname='read_factor_challenge_state' AND p.proargtypes='25 25 25 1184'::oidvector) OR
           (p.proname='record_factor_challenge_attempt' AND p.proargtypes='25 25 25 1184 2950 20 2950 25 25 23 23'::oidvector) OR
           (p.proname='consume_factor_totp_candidate' AND p.proargtypes='25 25 25 1184 2950 20 20 2950 23 23'::oidvector) OR
           (p.proname='consume_factor_recovery_candidate' AND p.proargtypes='25 25 25 1184 2950 20 2950 2950 23 23'::oidvector) OR
           (p.proname='read_factor_operation_receipt' AND p.proargtypes='25 25 25 1184 2950 25'::oidvector))) OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(role_record.oid,p.oid,'EXECUTE')) IS DISTINCT FROM 5 OR
     EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL
       aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
       WHERE d.datname=current_database() AND acl.grantee=role_record.oid AND
         (acl.privilege_type<>'CONNECT' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_database d CROSS JOIN LATERAL
       aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
       WHERE d.datname=current_database() AND acl.grantee=role_record.oid) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL
       aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
       WHERE s.nspname='groundbnb' AND acl.grantee=role_record.oid AND
         (acl.privilege_type<>'USAGE' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_namespace s CROSS JOIN LATERAL
       aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
       WHERE s.nspname='groundbnb' AND acl.grantee=role_record.oid) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE acl.grantee=role_record.oid AND
         (acl.privilege_type<>'EXECUTE' OR acl.is_grantable OR NOT (
           p.oid=to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)'::text) OR
           p.oid=to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)'::text) OR
           p.oid=to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)'::text) OR
           p.oid=to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)'::text) OR
           p.oid=to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)'::text))) OR
     EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL
       aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
       WHERE s.nspname<>'groundbnb' AND acl.grantee=role_record.oid) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN
         ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
          'consume_factor_recovery_candidate','read_factor_operation_receipt') AND
         (acl.grantee=0 OR (acl.grantee<>p.proowner AND acl.grantee<>role_record.oid) OR
          acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) THEN
    RAISE EXCEPTION 'Factor service role is not a passwordless function-only NOLOGIN principal';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid=helper_oid) IS DISTINCT FROM true OR
     (SELECT proconfig FROM pg_proc WHERE oid=helper_oid) IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
     helper_owner IS DISTINCT FROM owner_oid OR
     has_function_privilege(app_oid,helper_oid,'EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid=helper_oid AND (acl.grantee=0 OR acl.grantee<>p.proowner OR
         acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) OR
     (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE p.oid=helper_oid) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Factor identity helper security or app ACL changed';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0013_factor_service_principal');
COMMIT;
