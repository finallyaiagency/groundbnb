-- M1-01U. Dormant owner-scoped membership snapshot reader; no app grant.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record; receipt_count integer;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR receipt_count IS DISTINCT FROM 10 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0011_membership_reader') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0010 baseline and no prior 0011';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned app-role function-only ACL baseline differs from approved M1 boundary';
  END IF;
  IF to_regprocedure('groundbnb.read_membership(text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Membership reader already exists without its migration receipt';
  END IF;
END $$;

CREATE FUNCTION groundbnb.read_membership(identity_issuer text,identity_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; evaluated_at timestamptz; policy_value jsonb; base_count bigint;
  joined_base_count bigint; base_value jsonb; grant_count bigint; joined_grant_count bigint;
  grant_values jsonb; effective_grant jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  -- One statement snapshot keeps raw counts, integrity joins, policy, and returned data coherent.
  WITH evaluation AS MATERIALIZED (
      SELECT clock_timestamp() AS evaluated_at
    ),
    policy_rows AS MATERIALIZED (
      SELECT p.commercial_mode,p.enforced_test_cohorts,p.checkout_enabled,
        p.supplier_transactions_enabled,p.updated_at
        FROM groundbnb.membership_policy p CROSS JOIN evaluation e WHERE p.singleton
    ),
    active_base AS MATERIALIZED (
      SELECT a.*,e.evaluated_at FROM groundbnb.membership_assignments a CROSS JOIN evaluation e
        WHERE a.account_id=account_uuid AND a.status='active' AND a.effective_from<=e.evaluated_at
          AND (a.effective_until IS NULL OR a.effective_until>e.evaluated_at)
    ),
    valid_base AS MATERIALIZED (
      SELECT a.assignment_id,jsonb_build_object(
          'assignmentId',a.assignment_id,'planVersionId',pv.version_id,'planId',p.plan_id,
          'planKey',p.plan_key,'displayName',p.display_name,'planStatus',p.status,
          'versionNumber',pv.version_number,'releaseTier',pv.release_tier,
          'featureDefinitions',pv.feature_definitions,'limitDefinitions',pv.limit_definitions,
          'effectiveFrom',a.effective_from,'effectiveUntil',a.effective_until,'status',a.status,
          'grantType',a.grant_type) AS value
        FROM active_base a
        JOIN groundbnb.membership_plan_versions pv ON pv.version_id=a.plan_version_id
          AND pv.published_at IS NOT NULL AND pv.published_at<=a.evaluated_at
        JOIN groundbnb.membership_plans p ON p.plan_id=pv.plan_id
    ),
    active_grants AS MATERIALIZED (
      SELECT g.*,e.evaluated_at FROM groundbnb.access_grants g CROSS JOIN evaluation e
        WHERE g.account_id=account_uuid AND g.grant_type='lifetime' AND g.revoked_at IS NULL
          AND g.starts_at<=e.evaluated_at AND (g.expires_at IS NULL OR g.expires_at>e.evaluated_at)
    ),
    valid_grants AS MATERIALIZED (
      SELECT g.grant_id,g.starts_at,jsonb_build_object(
          'grantId',g.grant_id,'grantType',g.grant_type,'planVersionId',pv.version_id,
          'planId',p.plan_id,'planKey',p.plan_key,'displayName',p.display_name,'planStatus',p.status,
          'versionNumber',pv.version_number,'releaseTier',pv.release_tier,
          'featureDefinitions',pv.feature_definitions,'limitDefinitions',pv.limit_definitions,
          'grantedAt',g.granted_at,'startsAt',g.starts_at,'expiresAt',g.expires_at) AS value
        FROM active_grants g
        JOIN groundbnb.membership_plan_versions pv ON pv.version_id=g.plan_version_id
          AND pv.published_at IS NOT NULL AND pv.published_at<=g.evaluated_at
        JOIN groundbnb.membership_plans p ON p.plan_id=pv.plan_id
    ),
    base_summary AS (
      SELECT (SELECT count(*) FROM active_base) AS raw_count,
        (SELECT count(*) FROM valid_base) AS joined_count,
        (SELECT jsonb_agg(value ORDER BY assignment_id::text)->0 FROM valid_base) AS value
    ),
    grant_summary AS (
      SELECT (SELECT count(*) FROM active_grants) AS raw_count,
        (SELECT count(*) FROM valid_grants) AS joined_count,
        COALESCE((SELECT jsonb_agg(value ORDER BY starts_at DESC,grant_id::text ASC) FROM valid_grants),'[]'::jsonb) AS grant_list
    )
  SELECT (SELECT evaluated_at FROM evaluation),
      (SELECT jsonb_build_object('commercialMode',commercial_mode,
            'enforcedTestCohorts',enforced_test_cohorts,'checkoutEnabled',checkout_enabled,
            'supplierTransactionsEnabled',supplier_transactions_enabled,'updatedAt',updated_at)
          FROM policy_rows),
      base_summary.raw_count,base_summary.joined_count,base_summary.value,
      grant_summary.raw_count,grant_summary.joined_count,grant_summary.grant_list,grant_summary.grant_list->0
    INTO evaluated_at,policy_value,base_count,joined_base_count,base_value,
      grant_count,joined_grant_count,grant_values,effective_grant
    FROM base_summary CROSS JOIN grant_summary;

  IF policy_value IS NULL OR base_count IS DISTINCT FROM 1 OR joined_base_count IS DISTINCT FROM 1 OR
     grant_count IS DISTINCT FROM joined_grant_count THEN
    RETURN jsonb_build_object('ok',false,'category','membership_unavailable');
  END IF;

  RETURN jsonb_build_object('ok',true,'accountId',account_uuid,'evaluatedAt',evaluated_at,
    'policy',policy_value,
    'baseAssignment',base_value,'effectiveLifetimeGrants',grant_values,
    'effectiveLifetimeGrant',effective_grant);
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_membership(text,text) FROM PUBLIC;

DO $$
DECLARE e record; app_role text; app_oid oid; function_oid oid; function_owner oid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT p.oid,p.proowner INTO STRICT function_oid,function_owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='read_membership' AND p.proargtypes='25 25'::oidvector;
  IF has_function_privilege(app_oid,function_oid,'EXECUTE') OR EXISTS(
      SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
        WHERE p.oid=function_oid AND acl.grantee<>function_owner) THEN
    RAISE EXCEPTION 'Membership reader must remain private with no app-role or PUBLIC EXECUTE';
  END IF;
END $$;

INSERT INTO groundbnb.schema_migrations(version) VALUES('0011_membership_reader');
COMMIT;
