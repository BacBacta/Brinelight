CREATE TABLE "seals" (
	"id" serial PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"day" text NOT NULL,
	"root" text NOT NULL,
	"memo" text NOT NULL,
	"leaves" integer NOT NULL,
	"leaf_hashes" text NOT NULL,
	"signer" text NOT NULL,
	"signature" text NOT NULL,
	"tx" text NOT NULL,
	"last_valid_height" bigint NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "seals_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
ALTER TABLE "proofs" ADD COLUMN "seal_id" integer;--> statement-breakpoint
ALTER TABLE "proofs" ADD COLUMN "position" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "seals_one_a_night" ON "seals" USING btree ("cluster","day") WHERE status in ('sent', 'finalized');--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_seal_id_seals_id_fk" FOREIGN KEY ("seal_id") REFERENCES "public"."seals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proofs_seal_idx" ON "proofs" USING btree ("seal_id");