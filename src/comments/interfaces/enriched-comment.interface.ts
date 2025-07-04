import type { InferSelectModel } from "drizzle-orm";
import type { follows } from "@/profiles/profiles.schema";
import type { users } from "@/users/users.schema";
import type { comments } from "../comments.schema";

export type EnrichedComment = InferSelectModel<typeof comments> & {
	author: InferSelectModel<typeof users> & {
		followers?: InferSelectModel<typeof follows>[];
	};
};
