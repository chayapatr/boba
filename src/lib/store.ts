import { writable } from "svelte/store";

export const source = writable<string>('(1+1)*1+1')