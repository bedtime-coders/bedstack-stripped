import { DEFAULT_ERROR_MESSAGE } from "@/shared/constants";
import {
	RealWorldError,
	formatNotFoundError,
	formatValidationError,
	isElysiaError,
} from "@/shared/errors";
import { Elysia, NotFoundError, ValidationError } from "elysia";
import { pick } from "radashi";

export const errors = new Elysia().onError(({ error, code, set }) => {
	// Manually thrown errors
	if (error instanceof RealWorldError) {
		set.status = error.status;
		return pick(error, ["errors"]);
	}

	// Elysia validation errors (TypeBox based)
	if (error instanceof ValidationError) {
		return formatValidationError(error);
	}

	// Elysia not found errors
	if (error instanceof NotFoundError) {
		return formatNotFoundError(error);
	}

	// Generic error message
	const reason = isElysiaError(error) ? error.response : DEFAULT_ERROR_MESSAGE;
	return {
		errors: {
			[code]: [reason],
		},
	};
});
