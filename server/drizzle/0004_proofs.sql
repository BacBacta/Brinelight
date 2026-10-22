CREATE TABLE "proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"fact" text NOT NULL,
	"dated" text NOT NULL,
	"day" text NOT NULL,
	"salt" text NOT NULL,
	"leaf" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "proofs_player_fact" UNIQUE("player_id","fact")
);
--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;