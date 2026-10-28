CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."claim_request_status" AS ENUM('pending_consent', 'approved', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."consent_status_db" AS ENUM('active', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."correction_outcome_status" AS ENUM('submitted', 'under_review', 'applied', 'rejected', 'failed', 'partially_applied');--> statement-breakpoint
CREATE TYPE "public"."credential_status_db" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."entity_role" AS ENUM('issuer', 'verifier', 'admin');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('citizen', 'issuer', 'verifier', 'admin');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"type" text NOT NULL,
	"ref_id" text,
	"chain_tx" text,
	"prev_hash" text DEFAULT '0000000000000000000000000000000000000000000000000000000000000000' NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_cursor" (
	"contract_id" text PRIMARY KEY NOT NULL,
	"last_ledger" integer DEFAULT 0 NOT NULL,
	"last_event_id" text
);
--> statement-breakpoint
CREATE TABLE "claim_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verifier_id" uuid NOT NULL,
	"holder_id" uuid NOT NULL,
	"claims" text[] NOT NULL,
	"purpose" text NOT NULL,
	"nonce" text NOT NULL,
	"status" "claim_request_status" DEFAULT 'pending_consent' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"receipt_hash" text NOT NULL,
	"decisions" jsonb NOT NULL,
	"status" "consent_status_db" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"chain_tx" text,
	"ledger" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_receipt_hash_unique" UNIQUE("receipt_hash")
);
--> statement-breakpoint
CREATE TABLE "correction_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"status" "correction_outcome_status" DEFAULT 'submitted' NOT NULL,
	"reason_code" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chain_tx" text
);
--> statement-breakpoint
CREATE TABLE "correction_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correction_tickets_ticket_hash_unique" UNIQUE("ticket_hash")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer_id" uuid NOT NULL,
	"status" "credential_status_db" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"chain_tx" text,
	"ledger" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_credential_hash_unique" UNIQUE("credential_hash")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stellar_address" text NOT NULL,
	"role" "entity_role" NOT NULL,
	"name" text NOT NULL,
	"home_domain" text NOT NULL,
	"status" "entity_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_stellar_address_unique" UNIQUE("stellar_address")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"stellar_address" text,
	"passkey_credential_id" text,
	"synthetic_profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_stellar_address_unique" UNIQUE("stellar_address"),
	CONSTRAINT "users_passkey_credential_id_unique" UNIQUE("passkey_credential_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_issuer_id_entities_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_requests" ADD CONSTRAINT "claim_requests_verifier_id_entities_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_requests" ADD CONSTRAINT "claim_requests_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_request_id_claim_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."claim_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_outcomes" ADD CONSTRAINT "correction_outcomes_ticket_id_correction_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."correction_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_outcomes" ADD CONSTRAINT "correction_outcomes_institution_id_entities_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_tickets" ADD CONSTRAINT "correction_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issuer_id_entities_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;