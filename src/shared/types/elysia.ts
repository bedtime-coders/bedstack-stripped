/**
 * Type helper to extract static types from Elysia models
 * @example
 * ```ts
 * const { models } = usersModel;
 * type UserResponse = ModelsStatic<typeof models>["UserResponse"];
 * ```
 */
type SchemaWithStatic = { static: unknown };

export type ModelsStatic<T> = {
	[K in keyof T]: T[K] extends { Schema: () => SchemaWithStatic }
		? ReturnType<T[K]["Schema"]>["static"]
		: never;
};
