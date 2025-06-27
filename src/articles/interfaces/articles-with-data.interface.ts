import type { InferSelectModel } from "drizzle-orm";
import type { tags } from "@/tags/tags.schema";
import type { users } from "@/users/users.schema";
import type { articles } from "../articles.schema";

export type EnrichedArticle = InferSelectModel<typeof articles> & {
	author: InferSelectModel<typeof users>;
	tags: Array<{
		tag: InferSelectModel<typeof tags>;
	}>;
};
