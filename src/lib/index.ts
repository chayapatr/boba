import { run } from "./boba/runner"
export { beautify } from "./highlighter"

export const BOBA = (source: string) => run(source)