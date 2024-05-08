import { writable } from "svelte/store";

export const source = writable<string>('"hello"+3..14!=')