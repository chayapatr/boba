import { writable } from "svelte/store";

export const source = writable<string>('print "hello, world!";')