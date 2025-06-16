import { errors, openapi } from "@/core/plugins";
import { Elysia } from "elysia";
import { api } from "./api";

export const app = new Elysia().use(errors).use(openapi).use(api);
