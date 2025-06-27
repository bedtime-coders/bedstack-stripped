import type { InferSelectModel } from "drizzle-orm";
import type { follows } from "@/profiles/profiles.schema";
import type { tags } from "@/tags/tags.schema";
import type { users } from "@/users/users.schema";
import type { articles, favorites } from "../articles.schema";

export type EnrichedArticle = InferSelectModel<typeof articles> & {
	author: InferSelectModel<typeof users> & {
		followers?: Array<InferSelectModel<typeof follows>>;
	};
	tags: Array<{
		tag: InferSelectModel<typeof tags>;
	}>;
	favorites?: Array<InferSelectModel<typeof favorites>>;
};
