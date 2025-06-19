import { db } from "@/core/db";
import { Elysia } from "elysia";
import { tags } from "./tags.schema";

export const tagsPlugin = new Elysia({
	tags: ["Tags"],
}).get(
	"/tags",
	async () => {
		const allTags = await db.query.tags.findMany();
		return {
			tags: allTags.map((tag) => tag.name),
		};
	},
	{
		detail: {
			summary: "Get Tags",
			description: "Returns a list of all tags. No authentication required.",
			response: {
				tags: ["reactjs", "angularjs"],
			},
		},
	},
);
