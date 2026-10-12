-- Remove only an unused dormant 0015 pending-material resume contract; preserve factor history.
BEGIN;
DO $$
DECLARE e record; app_role text; factor_role text; app_oid oid; factor_oid oid;
  owner_oid oid; cloud_admin_oid oid; app_record record; factor_record record;
  receipt_count integer; app_functions oid[]; factor_functions oid[];
  expected_app_functions oid[]; expected_factor_functions oid[];
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
  IF app_role IS NULL OR factor_role IS NULL OR receipt_count IS DISTINCT FROM 15 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader',
       '0012_factor_service','0013_factor_service_principal','0014_factor_enrollment',
       '0015_factor_enrollment_resume']::text[])) IS DISTINCT FROM 15 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt',
         'record_factor_enrollment_material_release','read_factor_enrollment_material_receipt') AND
        (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
         p.prosecdef IS DISTINCT FROM true OR
         p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
         has_function_privilege(app_role,p.oid,'EXECUTE') OR has_function_privilege(factor_role,p.oid,'EXECUTE') OR
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt',
         'record_factor_enrollment_material_release','read_factor_enrollment_material_receipt')) IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0014 private dormant baseline';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((isfinite(created_at)andisfinite(completed_at)and(completed_at>=created_at)))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_operation_kind_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((operation_kind=any(array[''begin''::text,''verify''::text,''resume''::text])))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_status_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((status=any(array[''pending''::text,''rejected''::text,''verified''::text,''released''::text])))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_resume_begin_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check(((operation_kind=''resume''::text)and(begin_operation_idisnotnull))or((operation_kind=any(array[''begin''::text,''verify''::text]))and(begin_operation_idisnull)))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_resume_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check(((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))or((operation_kind=''resume''::text)and(status=any(array[''rejected''::text,''released''::text]))))') OR
     NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='groundbnb.factor_enrollment_operations'::regclass
       AND a.attname='begin_operation_id' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'Enrollment resume constraints or timestamp guard differ';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND p.prorettype='trigger'::regtype) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND
         (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
          p.prosecdef IS DISTINCT FROM false OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_role,p.oid,'EXECUTE') OR has_function_privilege(factor_role,p.oid,'EXECUTE') OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND NOT t.tgisinternal) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND
       NOT t.tgisinternal AND t.tgname='factor_enrollment_operation_immutable' AND
       t.tgfoid=to_regprocedure('groundbnb._guard_factor_enrollment_operation()')) THEN
    RAISE EXCEPTION 'Enrollment receipt immutability guard differs';
  END IF;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT cloud_admin_oid FROM pg_roles WHERE rolname='cloud_admin';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT oid INTO STRICT factor_oid FROM pg_roles WHERE rolname=factor_role;
  SELECT * INTO STRICT app_record FROM pg_roles WHERE oid=app_oid;
  SELECT * INTO STRICT factor_record FROM pg_roles WHERE oid=factor_oid;
  SELECT array_agg(p.oid ORDER BY p.oid) INTO app_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  SELECT array_agg(p.oid ORDER BY p.oid) INTO factor_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND has_function_privilege(factor_oid,p.oid,'EXECUTE');
  SELECT array_agg(v ORDER BY v) INTO expected_app_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_membership(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)')::oid,
    to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.refuse_production_synthetic_seed()')::oid]) AS x(v);
  SELECT array_agg(v ORDER BY v) INTO expected_factor_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)')::oid,
    to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)')::oid,
    to_regprocedure('groundbnb.refuse_production_synthetic_seed()')::oid]) AS x(v);
  IF NOT app_record.rolcanlogin OR app_record.rolsuper OR app_record.rolcreatedb OR app_record.rolcreaterole OR
     app_record.rolreplication OR app_record.rolbypassrls OR app_record.rolinherit OR
     app_record.rolconnlimit IS DISTINCT FROM 4 OR
     (app_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=app_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=app_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     app_functions IS DISTINCT FROM expected_app_functions OR
     factor_record.rolcanlogin IS DISTINCT FROM false OR factor_record.rolsuper OR factor_record.rolcreatedb OR
     factor_record.rolcreaterole OR factor_record.rolreplication OR factor_record.rolbypassrls OR factor_record.rolinherit OR
     factor_record.rolconnlimit IS DISTINCT FROM 2 OR factor_record.rolconfig IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=factor_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=factor_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=factor_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     factor_functions IS DISTINCT FROM expected_factor_functions OR
     NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
       WHERE p.oid=to_regprocedure('groundbnb.refuse_production_synthetic_seed()') AND
         p.prorettype='trigger'::regtype AND p.proowner=owner_oid AND p.prosecdef IS FALSE AND
         p.proconfig IS NULL AND l.lanname='plpgsql' AND p.proacl IS NULL AND
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE' AND NOT acl.is_grantable)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.oid<>to_regprocedure('groundbnb.refuse_production_synthetic_seed()') AND
         acl.grantee=0 AND acl.privilege_type='EXECUTE') OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_schema_privilege(factor_oid,'groundbnb','CREATE') OR has_schema_privilege(factor_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM aclexplode(COALESCE((SELECT c.relacl FROM pg_class c
       WHERE c.oid='groundbnb.factor_enrollment_operations'::regclass),acldefault('r',owner_oid))) acl
       WHERE acl.grantee=0 OR acl.grantee<>owner_oid OR acl.is_grantable) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(app_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(factor_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(factor_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('environment_identity','schema_migrations') AND
         c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(app_oid,c.oid,'INSERT') OR has_any_column_privilege(app_oid,c.oid,'UPDATE') OR
          has_any_column_privilege(app_oid,c.oid,'REFERENCES'))) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(app_oid,c.oid,'SELECT') OR has_any_column_privilege(app_oid,c.oid,'INSERT') OR
          has_any_column_privilege(app_oid,c.oid,'UPDATE') OR has_any_column_privilege(app_oid,c.oid,'REFERENCES'))) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(factor_oid,c.oid,'SELECT') OR has_any_column_privilege(factor_oid,c.oid,'INSERT') OR
          has_any_column_privilege(factor_oid,c.oid,'UPDATE') OR has_any_column_privilege(factor_oid,c.oid,'REFERENCES'))) THEN
    RAISE EXCEPTION 'Pinned app/factor access or principal boundary differs';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.factor_enrollment_operations WHERE operation_kind='resume') OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_audit WHERE outcome='enrollment_material_released' OR
       resume_operation_id IS NOT NULL OR begin_operation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback refused: pending-material resume history would be lost';
  END IF;
END $$;

DROP FUNCTION groundbnb.read_factor_enrollment_material_receipt(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid);
DROP FUNCTION groundbnb.record_factor_enrollment_material_release(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea);
ALTER TABLE groundbnb.privileged_factor_audit
  DROP CONSTRAINT privileged_factor_audit_resume_operation_check,
  DROP CONSTRAINT privileged_factor_audit_resume_operation_fk,
  DROP COLUMN resume_operation_id,
  DROP COLUMN begin_operation_id;
ALTER TABLE groundbnb.factor_enrollment_operations
  DROP CONSTRAINT factor_enrollment_operations_resume_check,
  DROP CONSTRAINT factor_enrollment_operations_status_check,
  DROP CONSTRAINT factor_enrollment_operations_operation_kind_check,
  DROP CONSTRAINT factor_enrollment_operations_resume_begin_check,
  DROP CONSTRAINT factor_enrollment_operations_operation_begin_key,
  DROP CONSTRAINT factor_enrollment_operations_begin_operation_fk,
  DROP COLUMN begin_operation_id,
  ADD CONSTRAINT factor_enrollment_operations_operation_kind_check CHECK (operation_kind IN ('begin','verify')),
  ADD CONSTRAINT factor_enrollment_operations_status_check CHECK (status IN ('pending','rejected','verified')),
  ADD CONSTRAINT factor_enrollment_operations_check1
    CHECK ((operation_kind='begin' AND status='pending') OR
           (operation_kind='verify' AND status IN ('rejected','verified')));
ALTER TABLE groundbnb.privileged_factor_audit
  DROP CONSTRAINT privileged_factor_audit_outcome_check,
  ADD CONSTRAINT privileged_factor_audit_outcome_check
    CHECK (outcome IN ('challenge_accepted','challenge_rejected','recovery_consumed',
      'enrollment_started','enrollment_verified','factor_revoked','factor_reset','rate_limited','attestation_revoked'));
DELETE FROM groundbnb.schema_migrations WHERE version='0015_factor_enrollment_resume';
COMMIT;
