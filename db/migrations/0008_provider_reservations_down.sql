-- Prepared rollback for 0008. Refuses any attempt, operation, usage, or rate history.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with migrations 0001-0008 applied';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(SELECT 1 FROM neon_auth."user"
      WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations')
       AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned app-role baseline differs from approved boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
      WHERE n.nspname='groundbnb' AND p.proname IN ('_financial_version_immutable','_provider_rate_version_guard',
        '_provider_limit_version_guard','_financial_control_audit','_financial_audit_immutable',
        '_provider_cost','reserve_provider_attempt','mark_provider_attempt_dispatched',
        'settle_provider_attempt','close_provider_operation')
        AND (acl.grantee=0 OR acl.grantee=role_record.oid) AND acl.privilege_type='EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN ('_financial_version_immutable','_provider_rate_version_guard',
        '_provider_limit_version_guard','_financial_control_audit','_financial_audit_immutable',
        '_provider_cost','reserve_provider_attempt','mark_provider_attempt_dispatched',
        'settle_provider_attempt','close_provider_operation')
        AND has_function_privilege(role_record.oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Financial functions and helpers must remain private';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.provider_attempt_reservations) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_operations) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_usage_windows) OR
     EXISTS(SELECT 1 FROM groundbnb.financial_control_audit) THEN
    RAISE EXCEPTION 'Rollback refused: provider attempts, operations, or usage windows would lose financial history';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.provider_rate_versions) OR EXISTS(SELECT 1 FROM groundbnb.provider_financial_limit_versions) OR
     (SELECT count(*) FROM groundbnb.financial_dispatch_control)<>1 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.financial_dispatch_control WHERE singleton AND mode='paused'
       AND policy_version_id='20000000-0000-4000-8000-000000000001') OR
     (SELECT count(*) FROM groundbnb.financial_policy_versions)<>1 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.financial_policy_versions WHERE version_key='m1-v1-default' AND status='active'
       AND application_daily_cap_usd=5.00 AND application_daily_held_usd=0.50
       AND application_monthly_cap_usd=100.00 AND application_monthly_held_usd=5.00
       AND free_pool_daily_cap_usd=2.50 AND provider_rate_policy='official_review_required') OR
     (SELECT count(*) FROM groundbnb.financial_plan_budgets)<>3 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.financial_plan_budgets WHERE plan_version_id='10000000-0000-4000-8000-000000000101'
       AND account_period='day' AND base_ai_usd=0.20 AND grace_ai_usd=0.03 AND grace_request_limit=2
       AND held_emergency_usd=0.02 AND hard_ai_usd=0.25 AND daily_provider_cap_usd=0.25
       AND ordinary_request_limit=10 AND max_concurrent_jobs=1) OR
     NOT EXISTS(SELECT 1 FROM groundbnb.financial_plan_budgets WHERE plan_version_id='10000000-0000-4000-8000-000000000102'
       AND account_period='calendar_month' AND base_ai_usd=10.00 AND grace_ai_usd=1.90 AND grace_request_limit=2147483647
       AND held_emergency_usd=0.10 AND hard_ai_usd=12.00 AND daily_provider_cap_usd=5.00
       AND ordinary_request_limit IS NULL AND max_concurrent_jobs=2) OR
     NOT EXISTS(SELECT 1 FROM groundbnb.financial_plan_budgets WHERE plan_version_id='10000000-0000-4000-8000-000000000103'
       AND account_period='calendar_month' AND base_ai_usd=30.00 AND grace_ai_usd=5.75 AND grace_request_limit=2147483647
       AND held_emergency_usd=0.25 AND hard_ai_usd=36.00 AND daily_provider_cap_usd=15.00
       AND ordinary_request_limit IS NULL AND max_concurrent_jobs=3) THEN
    RAISE EXCEPTION 'Rollback refused: financial policy/rates were configured or seed defaults changed';
  END IF;
END $$;

DROP FUNCTION groundbnb.close_provider_operation(text,text,uuid);
DROP FUNCTION groundbnb.settle_provider_attempt(text,text,uuid,jsonb,boolean);
DROP FUNCTION groundbnb.mark_provider_attempt_dispatched(text,text,uuid);
DROP FUNCTION groundbnb.reserve_provider_attempt(text,text,uuid,uuid,text,text,uuid,jsonb);
DROP FUNCTION groundbnb._provider_cost(uuid,jsonb);
DROP TABLE groundbnb.provider_attempt_reservations;
DROP TABLE groundbnb.provider_operations;
DROP TABLE groundbnb.provider_usage_windows;
DROP TABLE groundbnb.provider_financial_limit_versions;
DROP TABLE groundbnb.provider_rate_components;
DROP TABLE groundbnb.provider_rate_versions;
DROP TABLE groundbnb.financial_control_audit;
DROP TABLE groundbnb.financial_plan_budgets;
DROP TABLE groundbnb.financial_dispatch_control;
DROP TABLE groundbnb.financial_policy_versions;
DROP FUNCTION groundbnb._financial_control_audit();
DROP FUNCTION groundbnb._financial_audit_immutable();
DROP FUNCTION groundbnb._provider_limit_version_guard();
DROP FUNCTION groundbnb._provider_rate_version_guard();
DROP FUNCTION groundbnb._financial_version_immutable();
DELETE FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations';
COMMIT;
