import type { users } from "@/schema";
import type { SignFn } from "@/shared/plugins";
import type { ModelsStatic } from "@/shared/types/elysia";
import type { InferSelectModel } from "drizzle-orm";
import type { usersModel } from "../users.model";

export const toResponse = async (
	user: InferSelectModel<typeof users>,
	sign: SignFn,
): Promise<ModelsStatic<typeof usersModel.models>["UserResponse"]> => {
	const { email, username, bio, image } = user;
	return {
		user: {
			token: await sign({ uid: user.id, email, username }),
			email,
			username,
			bio,
			image,
		},
	};
};
