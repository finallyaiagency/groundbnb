-- M1-01F. Expands account-profile answers on the pinned synthetic local/preview branches only.
-- Generated validator registry is frozen below with its source hash. This migration is prepared, not applied.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
    ELSE NULL END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') THEN
    RAISE EXCEPTION 'Requires the pinned local/preview branch with M0/M1-01D and no prior M1-01F';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(SELECT 1 FROM neon_auth."user"
      WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from the approved M1-01D boundary';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM groundbnb.profiles) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE field NOT IN
       ('homeAddress','dietaryRequirements','specialRequirements','hasPets','alwaysBeginEndAtHome','travelerCount','preferredRegions')) THEN
    RAISE EXCEPTION 'Unexpected M1-01D profile baseline';
  END IF;
END $$;

ALTER TABLE groundbnb.profile_answers DROP CONSTRAINT profile_answers_field_check;
ALTER TABLE groundbnb.profile_answers ADD CONSTRAINT profile_answers_field_check CHECK(field IN ('homeAddress', 'homePoint', 'alwaysBeginEndAtHome', 'groupComposition', 'travelerCount', 'ageGroups', 'hasPets', 'petTypes', 'preferredRegions', 'dietaryRequirements', 'specialRequirements', 'travelModes', 'travelSeason', 'overnightPreferences', 'activities', 'drivingPace', 'maxDrivingHoursPerDay', 'budgetLevel', 'budgetMode', 'budgetTimeframe', 'budgetAmount', 'budgetCurrency', 'comfortLevel', 'allowSplurge', 'splurgeAmount', 'splurgeCurrency', 'splurgeMode', 'splurgeTimeframe', 'splurgeFrequency', 'splurgeTypes', 'needsFoodAccess', 'needsFacilities', 'needsWalkableTransit', 'includeSupportServices', 'avoidHighways', 'preferScenic', 'avoidTolls', 'avoidMountainRoutes', 'accessibility', 'needHookups', 'sustainability', 'planningStyle', 'budgetSensitivity', 'preferredTransport', 'travelScope', 'climate', 'riskTolerance', 'physicalCapacity', 'planningHorizon', 'willingToReposition', 'comparisonMode', 'terrain', 'incomeOffsets', 'legalSafety', 'emotionalGoals'));

-- Generated profile registry SHA-256: 5BE2FD8ADC201DDDFC7BA8089F1424FA9223226F8B23CBBD3B7174D233DA36DA
-- Frozen profile-domain registry snapshot:
-- {
--   "version": 1,
--   "fields": {
--     "homeAddress": {
--       "type": "text"
--     },
--     "homePoint": {
--       "type": "nullablePoint"
--     },
--     "alwaysBeginEndAtHome": {
--       "type": "boolean"
--     },
--     "groupComposition": {
--       "type": "choice",
--       "catalog": "groupComposition"
--     },
--     "travelerCount": {
--       "type": "nullableInteger",
--       "min": 1,
--       "max": 999
--     },
--     "ageGroups": {
--       "type": "choiceList",
--       "catalog": "ageGroups"
--     },
--     "hasPets": {
--       "type": "nullableBoolean"
--     },
--     "petTypes": {
--       "type": "choiceList",
--       "catalog": "petTypes"
--     },
--     "preferredRegions": {
--       "type": "textList"
--     },
--     "dietaryRequirements": {
--       "type": "text"
--     },
--     "specialRequirements": {
--       "type": "text"
--     },
--     "travelModes": {
--       "type": "choiceList",
--       "catalog": "travelModes"
--     },
--     "travelSeason": {
--       "type": "choice",
--       "catalog": "travelSeason"
--     },
--     "overnightPreferences": {
--       "type": "manualChoiceList",
--       "maxItems": 64,
--       "maxItemLength": 200
--     },
--     "activities": {
--       "type": "choiceList",
--       "catalog": "activities"
--     },
--     "drivingPace": {
--       "type": "choice",
--       "catalog": "drivingPace"
--     },
--     "maxDrivingHoursPerDay": {
--       "type": "nullableNumber",
--       "minExclusive": 0,
--       "max": 24
--     },
--     "budgetLevel": {
--       "type": "choice",
--       "catalog": "budgetLevel"
--     },
--     "budgetMode": {
--       "type": "choice",
--       "catalog": "budgetMode"
--     },
--     "budgetTimeframe": {
--       "type": "choice",
--       "catalog": "budgetTimeframe"
--     },
--     "budgetAmount": {
--       "type": "nullableDecimal"
--     },
--     "budgetCurrency": {
--       "type": "nullableCurrency"
--     },
--     "comfortLevel": {
--       "type": "nullableInteger",
--       "min": 0,
--       "max": 5
--     },
--     "allowSplurge": {
--       "type": "nullableBoolean"
--     },
--     "splurgeAmount": {
--       "type": "nullableDecimal"
--     },
--     "splurgeCurrency": {
--       "type": "nullableCurrency"
--     },
--     "splurgeMode": {
--       "type": "choice",
--       "catalog": "splurgeMode"
--     },
--     "splurgeTimeframe": {
--       "type": "choice",
--       "catalog": "splurgeTimeframe"
--     },
--     "splurgeFrequency": {
--       "type": "choice",
--       "catalog": "splurgeFrequency"
--     },
--     "splurgeTypes": {
--       "type": "choiceList",
--       "catalog": "splurgeTypes"
--     },
--     "needsFoodAccess": {
--       "type": "nullableBoolean"
--     },
--     "needsFacilities": {
--       "type": "nullableBoolean"
--     },
--     "needsWalkableTransit": {
--       "type": "nullableBoolean"
--     },
--     "includeSupportServices": {
--       "type": "nullableBoolean"
--     },
--     "avoidHighways": {
--       "type": "nullableBoolean"
--     },
--     "preferScenic": {
--       "type": "nullableBoolean"
--     },
--     "avoidTolls": {
--       "type": "nullableBoolean"
--     },
--     "avoidMountainRoutes": {
--       "type": "nullableBoolean"
--     },
--     "accessibility": {
--       "type": "choice",
--       "catalog": "accessibility"
--     },
--     "needHookups": {
--       "type": "choice",
--       "catalog": "needHookups"
--     },
--     "sustainability": {
--       "type": "choice",
--       "catalog": "sustainability"
--     },
--     "planningStyle": {
--       "type": "choice",
--       "catalog": "planningStyle"
--     },
--     "budgetSensitivity": {
--       "type": "choice",
--       "catalog": "budgetSensitivity"
--     },
--     "preferredTransport": {
--       "type": "choiceList",
--       "catalog": "preferredTransport"
--     },
--     "travelScope": {
--       "type": "choice",
--       "catalog": "travelScope"
--     },
--     "climate": {
--       "type": "choice",
--       "catalog": "climate"
--     },
--     "riskTolerance": {
--       "type": "choice",
--       "catalog": "riskTolerance"
--     },
--     "physicalCapacity": {
--       "type": "choice",
--       "catalog": "physicalCapacity"
--     },
--     "planningHorizon": {
--       "type": "choice",
--       "catalog": "planningHorizon"
--     },
--     "willingToReposition": {
--       "type": "nullableBoolean"
--     },
--     "comparisonMode": {
--       "type": "nullableBoolean"
--     },
--     "terrain": {
--       "type": "choiceList",
--       "catalog": "terrain"
--     },
--     "incomeOffsets": {
--       "type": "manualChoiceList",
--       "maxItems": 64,
--       "maxItemLength": 200
--     },
--     "legalSafety": {
--       "type": "choiceList",
--       "catalog": "legalSafety"
--     },
--     "emotionalGoals": {
--       "type": "choiceList",
--       "catalog": "emotionalGoals"
--     }
--   },
--   "catalogs": {
--     "groupComposition": [
--       "Solo",
--       "Couple",
--       "Friends",
--       "Family",
--       "Grandparents + Grandkids",
--       "Large Group",
--       "Custom Group Size"
--     ],
--     "ageGroups": [
--       "Children 0–12",
--       "Teens 13–17",
--       "Adults 18–64",
--       "Seniors 65+"
--     ],
--     "petTypes": [
--       "Dog",
--       "Small Dog",
--       "Large Dog",
--       "Cat",
--       "Other"
--     ],
--     "travelModes": [
--       "RV",
--       "Van/Class B",
--       "Car/SUV",
--       "On Foot/Transit",
--       "Hike/Backpack",
--       "Plane/Flight",
--       "Train/Rail",
--       "Rental Car",
--       "Bicycle",
--       "Truck Camper",
--       "Travel Trailer",
--       "Fifth Wheel",
--       "Class A",
--       "Class C",
--       "Boat/Yacht"
--     ],
--     "travelSeason": [
--       "Spring",
--       "Summer",
--       "Fall",
--       "Winter",
--       "Year-round"
--     ],
--     "activities": [
--       "hiking/backpacking",
--       "camping",
--       "climbing",
--       "scuba/snorkeling",
--       "skiing/snowboarding",
--       "extreme sports",
--       "sailing/boating",
--       "fishing",
--       "kayaking",
--       "biking",
--       "off-roading",
--       "nature walks",
--       "spa/hot springs",
--       "beach leisure",
--       "scenic cruises",
--       "wellness",
--       "swimming",
--       "stargazing",
--       "guided tours",
--       "historical sites",
--       "local food",
--       "festivals",
--       "bowling",
--       "volunteer travel",
--       "photography",
--       "wildlife watching",
--       "community meals",
--       "local resources"
--     ],
--     "drivingPace": [
--       "Fastest",
--       "Balanced",
--       "Scenic"
--     ],
--     "budgetLevel": [
--       "Free/Minimal Cost",
--       "Budget",
--       "Moderate",
--       "Comfort",
--       "Luxury"
--     ],
--     "budgetMode": [
--       "per_person",
--       "total"
--     ],
--     "budgetTimeframe": [
--       "daily",
--       "weekly",
--       "monthly",
--       "full_trip"
--     ],
--     "comfortLevel": [
--       "Rugged/Survival",
--       "Minimalist",
--       "Balanced",
--       "Comfortable",
--       "Luxury",
--       "Ultra-Luxury"
--     ],
--     "splurgeMode": [
--       "per_person",
--       "total"
--     ],
--     "splurgeTimeframe": [
--       "per_day",
--       "per_week",
--       "per_month",
--       "per_event"
--     ],
--     "splurgeFrequency": [
--       "Once per Trip",
--       "Once per Month",
--       "Once per Week",
--       "Every Few Days",
--       "Whenever Available"
--     ],
--     "splurgeTypes": [
--       "Accommodation",
--       "Experience",
--       "Comfort",
--       "Transportation upgrade"
--     ],
--     "accessibility": [
--       "Mobility-Friendly Only",
--       "Low-Impact Activities",
--       "No Restrictions"
--     ],
--     "needHookups": [
--       "Yes",
--       "Nice to Have",
--       "No"
--     ],
--     "climate": [
--       "Warm",
--       "Cold",
--       "Seasonal",
--       "No Preference"
--     ],
--     "terrain": [
--       "Coastal",
--       "Mountains",
--       "Forest",
--       "Urban",
--       "Mixed"
--     ],
--     "sustainability": [
--       "Budget First",
--       "Balanced",
--       "Eco-Priority"
--     ],
--     "planningStyle": [
--       "Fully Structured",
--       "Flexible Framework",
--       "Highly Spontaneous"
--     ],
--     "budgetSensitivity": [
--       "Strict",
--       "Flexible",
--       "Optimized"
--     ],
--     "preferredTransport": [
--       "Flight",
--       "Train",
--       "Bus",
--       "Car Rental",
--       "RV",
--       "Boat"
--     ],
--     "travelScope": [
--       "Domestic Only",
--       "International Allowed"
--     ],
--     "riskTolerance": [
--       "Low Risk",
--       "Moderate Adventure",
--       "High Adrenaline"
--     ],
--     "physicalCapacity": [
--       "Sedentary",
--       "Moderately Active",
--       "High Endurance",
--       "Elite/Extreme"
--     ],
--     "planningHorizon": [
--       "under 30 days",
--       "1–3 months",
--       "3–12 months",
--       "Long-Term/Open-Ended"
--     ],
--     "legalSafety": [
--       "Legal Camping Only",
--       "Permit Alerts Required",
--       "Insurance Recommendations",
--       "No Special Requirements"
--     ],
--     "emotionalGoals": [
--       "Recharge/Rest",
--       "Family Bonding",
--       "Achievement/Challenge",
--       "Escape/Reset",
--       "Status/Premium",
--       "Simplicity/Minimalism"
--     ]
--   },
--   "currencies": [
--     "AED",
--     "AFN",
--     "ALL",
--     "AMD",
--     "ANG",
--     "AOA",
--     "ARS",
--     "AUD",
--     "AWG",
--     "AZN",
--     "BAM",
--     "BBD",
--     "BDT",
--     "BGN",
--     "BHD",
--     "BIF",
--     "BMD",
--     "BND",
--     "BOB",
--     "BRL",
--     "BSD",
--     "BTN",
--     "BWP",
--     "BYN",
--     "BZD",
--     "CAD",
--     "CDF",
--     "CHF",
--     "CLP",
--     "CNY",
--     "COP",
--     "CRC",
--     "CUC",
--     "CUP",
--     "CVE",
--     "CZK",
--     "DJF",
--     "DKK",
--     "DOP",
--     "DZD",
--     "EGP",
--     "ERN",
--     "ETB",
--     "EUR",
--     "FJD",
--     "FKP",
--     "GBP",
--     "GEL",
--     "GHS",
--     "GIP",
--     "GMD",
--     "GNF",
--     "GTQ",
--     "GYD",
--     "HKD",
--     "HNL",
--     "HRK",
--     "HTG",
--     "HUF",
--     "IDR",
--     "ILS",
--     "INR",
--     "IQD",
--     "IRR",
--     "ISK",
--     "JMD",
--     "JOD",
--     "JPY",
--     "KES",
--     "KGS",
--     "KHR",
--     "KMF",
--     "KPW",
--     "KRW",
--     "KWD",
--     "KYD",
--     "KZT",
--     "LAK",
--     "LBP",
--     "LKR",
--     "LRD",
--     "LSL",
--     "LYD",
--     "MAD",
--     "MDL",
--     "MGA",
--     "MKD",
--     "MMK",
--     "MNT",
--     "MOP",
--     "MRU",
--     "MUR",
--     "MVR",
--     "MWK",
--     "MXN",
--     "MYR",
--     "MZN",
--     "NAD",
--     "NGN",
--     "NIO",
--     "NOK",
--     "NPR",
--     "NZD",
--     "OMR",
--     "PAB",
--     "PEN",
--     "PGK",
--     "PHP",
--     "PKR",
--     "PLN",
--     "PYG",
--     "QAR",
--     "RON",
--     "RSD",
--     "RUB",
--     "RWF",
--     "SAR",
--     "SBD",
--     "SCR",
--     "SDG",
--     "SEK",
--     "SGD",
--     "SHP",
--     "SLE",
--     "SLL",
--     "SOS",
--     "SRD",
--     "SSP",
--     "STN",
--     "SVC",
--     "SYP",
--     "SZL",
--     "THB",
--     "TJS",
--     "TMT",
--     "TND",
--     "TOP",
--     "TRY",
--     "TTD",
--     "TWD",
--     "TZS",
--     "UAH",
--     "UGX",
--     "USD",
--     "UYU",
--     "UZS",
--     "VES",
--     "VND",
--     "VUV",
--     "WST",
--     "XAF",
--     "XCD",
--     "XCG",
--     "XDR",
--     "XOF",
--     "XPF",
--     "XSU",
--     "YER",
--     "ZAR",
--     "ZMW",
--     "ZWG",
--     "ZWL"
--   ]
-- }

CREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch(patch jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE item record; answer_value jsonb; value_type text; field_count integer;
BEGIN
  IF patch IS NULL OR jsonb_typeof(patch)<>'object' OR octet_length(patch::text)>16384 THEN RETURN false; END IF;
  SELECT count(*) INTO field_count FROM jsonb_object_keys(patch);
  IF field_count NOT BETWEEN 1 AND 55 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(patch) LOOP
    IF item.key NOT IN ('homeAddress', 'homePoint', 'alwaysBeginEndAtHome', 'groupComposition', 'travelerCount', 'ageGroups', 'hasPets', 'petTypes', 'preferredRegions', 'dietaryRequirements', 'specialRequirements', 'travelModes', 'travelSeason', 'overnightPreferences', 'activities', 'drivingPace', 'maxDrivingHoursPerDay', 'budgetLevel', 'budgetMode', 'budgetTimeframe', 'budgetAmount', 'budgetCurrency', 'comfortLevel', 'allowSplurge', 'splurgeAmount', 'splurgeCurrency', 'splurgeMode', 'splurgeTimeframe', 'splurgeFrequency', 'splurgeTypes', 'needsFoodAccess', 'needsFacilities', 'needsWalkableTransit', 'includeSupportServices', 'avoidHighways', 'preferScenic', 'avoidTolls', 'avoidMountainRoutes', 'accessibility', 'needHookups', 'sustainability', 'planningStyle', 'budgetSensitivity', 'preferredTransport', 'travelScope', 'climate', 'riskTolerance', 'physicalCapacity', 'planningHorizon', 'willingToReposition', 'comparisonMode', 'terrain', 'incomeOffsets', 'legalSafety', 'emotionalGoals') OR jsonb_typeof(item.value)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item.value))<>2 OR
      NOT (item.value ? 'value' AND item.value ? 'answered') OR
      jsonb_typeof(item.value->'answered')<>'boolean' THEN RETURN false; END IF;
    answer_value := item.value->'value'; value_type := jsonb_typeof(answer_value);
    IF item.value->'answered'='false'::jsonb AND value_type<>'null' AND
      NOT CASE WHEN value_type='array' THEN jsonb_array_length(answer_value)=0 ELSE false END THEN RETURN false; END IF;
    CASE
      WHEN item.key='homeAddress' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND (length(answer_value #>> '{}')=0 OR btrim(answer_value #>> '{}')='') THEN RETURN false; END IF;
      WHEN item.key='homePoint' THEN
        IF value_type NOT IN ('null','object') THEN RETURN false; END IF;
        -- Resolved home points remain read-only until a provenance-bound resolver path exists.
        IF value_type='object' THEN RETURN false; END IF;
      WHEN item.key='alwaysBeginEndAtHome' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
      WHEN item.key='groupComposition' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Solo','Couple','Friends','Family','Grandparents + Grandkids','Large Group','Custom Group Size']::text[])) THEN RETURN false; END IF;
      WHEN item.key='travelerCount' THEN
        IF value_type NOT IN ('null','number') THEN RETURN false; END IF;
        IF value_type='number' AND ((answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)$' OR
          (answer_value #>> '{}')::numeric>9007199254740991 OR (answer_value #>> '{}')::numeric<1 OR (answer_value #>> '{}')::numeric>999) THEN RETURN false; END IF;
      WHEN item.key='ageGroups' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Children 0–12','Teens 13–17','Adults 18–64','Seniors 65+']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='hasPets' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='petTypes' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Dog','Small Dog','Large Dog','Cat','Other']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='preferredRegions' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR btrim(v #>> '{}')='') THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='dietaryRequirements' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND (length(answer_value #>> '{}')=0 OR btrim(answer_value #>> '{}')='') THEN RETURN false; END IF;
      WHEN item.key='specialRequirements' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND (length(answer_value #>> '{}')=0 OR btrim(answer_value #>> '{}')='') THEN RETURN false; END IF;
      WHEN item.key='travelModes' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['RV','Van/Class B','Car/SUV','On Foot/Transit','Hike/Backpack','Plane/Flight','Train/Rail','Rental Car','Bicycle','Truck Camper','Travel Trailer','Fifth Wheel','Class A','Class C','Boat/Yacht']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='travelSeason' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Spring','Summer','Fall','Winter','Year-round']::text[])) THEN RETURN false; END IF;
      WHEN item.key='overnightPreferences' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF jsonb_array_length(answer_value)>64 THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}') NOT BETWEEN 1 AND 200 OR btrim(v #>> '{}')='') THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='activities' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['hiking/backpacking','camping','climbing','scuba/snorkeling','skiing/snowboarding','extreme sports','sailing/boating','fishing','kayaking','biking','off-roading','nature walks','spa/hot springs','beach leisure','scenic cruises','wellness','swimming','stargazing','guided tours','historical sites','local food','festivals','bowling','volunteer travel','photography','wildlife watching','community meals','local resources']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='drivingPace' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Fastest','Balanced','Scenic']::text[])) THEN RETURN false; END IF;
      WHEN item.key='maxDrivingHoursPerDay' THEN
        IF value_type NOT IN ('null','number') THEN RETURN false; END IF;
        IF value_type='number' AND ((answer_value #>> '{}')::numeric<=0 OR (answer_value #>> '{}')::numeric>24) THEN RETURN false; END IF;
      WHEN item.key='budgetLevel' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Free/Minimal Cost','Budget','Moderate','Comfort','Luxury']::text[])) THEN RETURN false; END IF;
      WHEN item.key='budgetMode' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['per_person','total']::text[])) THEN RETURN false; END IF;
      WHEN item.key='budgetTimeframe' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['daily','weekly','monthly','full_trip']::text[])) THEN RETURN false; END IF;
      WHEN item.key='budgetAmount' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF value_type='string' AND (length(answer_value #>> '{}')>256 OR (answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$') THEN RETURN false; END IF;
      WHEN item.key='budgetCurrency' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL']::text[])) THEN RETURN false; END IF;
      WHEN item.key='comfortLevel' THEN
        IF value_type NOT IN ('null','number') THEN RETURN false; END IF;
        IF value_type='number' AND ((answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)$' OR
          (answer_value #>> '{}')::numeric>9007199254740991 OR (answer_value #>> '{}')::numeric<0 OR (answer_value #>> '{}')::numeric>5) THEN RETURN false; END IF;
      WHEN item.key='allowSplurge' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='splurgeAmount' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF value_type='string' AND (length(answer_value #>> '{}')>256 OR (answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$') THEN RETURN false; END IF;
      WHEN item.key='splurgeCurrency' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL']::text[])) THEN RETURN false; END IF;
      WHEN item.key='splurgeMode' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['per_person','total']::text[])) THEN RETURN false; END IF;
      WHEN item.key='splurgeTimeframe' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['per_day','per_week','per_month','per_event']::text[])) THEN RETURN false; END IF;
      WHEN item.key='splurgeFrequency' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Once per Trip','Once per Month','Once per Week','Every Few Days','Whenever Available']::text[])) THEN RETURN false; END IF;
      WHEN item.key='splurgeTypes' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Accommodation','Experience','Comfort','Transportation upgrade']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='needsFoodAccess' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='needsFacilities' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='needsWalkableTransit' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='includeSupportServices' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='avoidHighways' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='preferScenic' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='avoidTolls' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='avoidMountainRoutes' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='accessibility' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Mobility-Friendly Only','Low-Impact Activities','No Restrictions']::text[])) THEN RETURN false; END IF;
      WHEN item.key='needHookups' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Yes','Nice to Have','No']::text[])) THEN RETURN false; END IF;
      WHEN item.key='sustainability' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Budget First','Balanced','Eco-Priority']::text[])) THEN RETURN false; END IF;
      WHEN item.key='planningStyle' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Fully Structured','Flexible Framework','Highly Spontaneous']::text[])) THEN RETURN false; END IF;
      WHEN item.key='budgetSensitivity' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Strict','Flexible','Optimized']::text[])) THEN RETURN false; END IF;
      WHEN item.key='preferredTransport' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Flight','Train','Bus','Car Rental','RV','Boat']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='travelScope' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Domestic Only','International Allowed']::text[])) THEN RETURN false; END IF;
      WHEN item.key='climate' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Warm','Cold','Seasonal','No Preference']::text[])) THEN RETURN false; END IF;
      WHEN item.key='riskTolerance' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Low Risk','Moderate Adventure','High Adrenaline']::text[])) THEN RETURN false; END IF;
      WHEN item.key='physicalCapacity' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['Sedentary','Moderately Active','High Endurance','Elite/Extreme']::text[])) THEN RETURN false; END IF;
      WHEN item.key='planningHorizon' THEN
        IF value_type NOT IN ('null','string') THEN RETURN false; END IF;
        IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(ARRAY['under 30 days','1–3 months','3–12 months','Long-Term/Open-Ended']::text[])) THEN RETURN false; END IF;
      WHEN item.key='willingToReposition' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='comparisonMode' THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='terrain' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Coastal','Mountains','Forest','Urban','Mixed']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='incomeOffsets' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF jsonb_array_length(answer_value)>64 THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}') NOT BETWEEN 1 AND 200 OR btrim(v #>> '{}')='') THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='legalSafety' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Legal Camping Only','Permit Alerts Required','Insurance Recommendations','No Special Requirements']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      WHEN item.key='emotionalGoals' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(ARRAY['Recharge/Rest','Family Bonding','Achievement/Challenge','Escape/Reset','Status/Premium','Simplicity/Minimalism']::text[])) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;
      ELSE RETURN false;
    END CASE;
  END LOOP;
  RETURN true;
END $$;

DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE e.kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('accounts','account_identities','profiles','profile_answers','profile_operations')
       AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname='_valid_profile_patch' AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'M1-01F must preserve the restricted application function-only boundary';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0003_profile_domain');
COMMIT;
