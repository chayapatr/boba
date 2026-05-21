export type Value = number | string | boolean | null

export class Environment {
    private values = new Map<string, Value>()

    constructor(private parent: Environment | null = null) {}

    define(name: string, value: Value): void {
        this.values.set(name, value)
    }

    get(name: string): Value {
        if (this.values.has(name)) return this.values.get(name)!
        if (this.parent) return this.parent.get(name)
        throw new Error(`Undefined variable '${name}'.`)
    }

    set(name: string, value: Value): void {
        if (this.values.has(name)) { this.values.set(name, value); return }
        if (this.parent) { this.parent.set(name, value); return }
        throw new Error(`Undefined variable '${name}'.`)
    }
}
