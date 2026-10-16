CREATE TABLE "applied_actions" (
	"player_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"action_hash" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	"ok" boolean NOT NULL,
	"code" text,
	"error" text,
	CONSTRAINT "applied_actions_player_id_action_id_pk" PRIMARY KEY("player_id","action_id")
);
--> statement-breakpoint
ALTER TABLE "applied_actions" ADD CONSTRAINT "applied_actions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applied_actions_at_idx" ON "applied_actions" USING btree ("applied_at");