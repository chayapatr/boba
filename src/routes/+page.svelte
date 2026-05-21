<script lang="ts">
	// @ts-nocheck
	import { BOBA } from '$lib';
	import type { ASTNode } from '$lib/boba/parser/generator';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';
	import { onMount } from 'svelte';

	$: result = BOBA($source);

	// ── Dark mode ────────────────────────────────────────────────
	let dark = false;
	$: if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('dark', dark);
	}

	// ── Shareable URL ────────────────────────────────────────────
	onMount(() => {
		const hash = window.location.hash.slice(1);
		if (hash) {
			try { $source = decodeURIComponent(hash); } catch {}
		}
	});

	$: if (typeof window !== 'undefined' && $source) {
		window.location.hash = encodeURIComponent($source);
	}

	// ── Examples ─────────────────────────────────────────────────
	const examples = [
		{
			label: 'Hello World',
			code: 'print "hello, world!";'
		},
		{
			label: 'Arithmetic',
			code: 'print 1 + 2 * 3;\nprint 10 / 2 - 1;'
		},
		{
			label: 'Variables',
			code: 'let x = 10;\nlet y = 20;\nprint x + y;'
		},
		{
			label: 'If / Else',
			code: 'let x = 5;\nif (x > 3) {\n  print "big";\n} else {\n  print "small";\n}'
		},
		{
			label: 'While Loop',
			code: 'let i = 0;\nwhile (i < 5) {\n  print i;\n  i = i + 1;\n}'
		},
		{
			label: 'String concat',
			code: 'let name = "boba";\nprint "hello, " + name + "!";\nprint "2 + 2 = " + (2 + 2);'
		}
	];

	// ── AST export ───────────────────────────────────────────────
	const exportAST = () => {
		const json = JSON.stringify(result.parsed.nodes, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'boba-ast.json';
		a.click();
		URL.revokeObjectURL(url);
	};

	// ── Error token position ──────────────────────────────────────
	// Extract which line has the error token from the scan error message
	$: errorLine = (() => {
		if (result.scanned.success) return null;
		const m = result.scanned.msg.match(/\[LINE (\d+)\]/);
		return m ? parseInt(m[1]) : null;
	})();

	// ── Bracket matching ─────────────────────────────────────────
	// Track cursor position to find matching bracket
	let cursorPos = 0;
	$: matchedBrackets = (() => {
		const src = $source;
		const pos = cursorPos;
		if (!src || pos < 0) return null;

		const opens = '({[';
		const closes = ')}]';
		const ch = src[pos] ?? src[pos - 1];
		const idx = pos < src.length ? pos : pos - 1;
		const c = src[idx];

		if (!c) return null;

		const openIdx = opens.indexOf(c);
		const closeIdx = closes.indexOf(c);

		if (openIdx !== -1) {
			// scan forward for matching close
			let depth = 0;
			for (let i = idx; i < src.length; i++) {
				if (src[i] === opens[openIdx]) depth++;
				if (src[i] === closes[openIdx]) depth--;
				if (depth === 0) return [idx, i];
			}
		} else if (closeIdx !== -1) {
			// scan backward for matching open
			let depth = 0;
			for (let i = idx; i >= 0; i--) {
				if (src[i] === closes[closeIdx]) depth++;
				if (src[i] === opens[closeIdx]) depth--;
				if (depth === 0) return [i, idx];
			}
		}
		return null;
	})();

	// ── AST renderer ─────────────────────────────────────────────
	const ASTtoString = (nodes: ASTNode[]): string => {
		if (!nodes || nodes.length === 0) return '';

		const dfs = (node: ASTNode, prefix: string): string => {
			const n = node as Record<string, unknown>;
			switch (n.type as string) {
				case 'LITERAL':
					return `<br/>${prefix}⊢ VALUE: ${n.expr}`;
				case 'BINARY':
					return `<br/>${prefix}⊢ BIN (${(n.opr as Token).lexeme})${dfs(n.left as ASTNode, prefix + '&nbsp;&nbsp;')}${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'GROUPING':
					return `<br/>${prefix}⊢ [GROUP]${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'UNARY':
					return `<br/>${prefix}⊢ UNARY (${(n.opr as Token).lexeme})${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VARIABLE':
					return `<br/>${prefix}⊢ VAR: ${(n.name as Token).lexeme}`;
				case 'ASSIGN':
					return `<br/>${prefix}⊢ ASSIGN (${n.name})${dfs(n.value as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'EXPRESSION':
					return `<br/>${prefix}⊢ EXPR${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'PRINT':
					return `<br/>${prefix}⊢ PRINT${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VAR':
					return `<br/>${prefix}⊢ VAR DECL: ${n.name}${n.expr ? dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;') : ''}`;
				case 'IF':
					return (
						`<br/>${prefix}⊢ IF${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;THEN: ${(n.then as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}` +
						(n.else
							? `<br/>${prefix}&nbsp;&nbsp;ELSE: ${(n.else as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
							: '')
					);
				case 'WHILE':
					return (
						`<br/>${prefix}⊢ WHILE${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;BODY: ${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
					);
				case 'BLOCK':
					return `<br/>${prefix}⊢ BLOCK${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;')).join('')}`;
				default:
					return `<br/>${prefix}⊢ ${n.type}`;
			}
		};

		return '<span class="font-semibold">PROGRAM</span>' + nodes.map((n) => dfs(n, '')).join('');
	};
</script>

<div
	class="grid h-[100svh] gap-3 p-3 font-mono md:grid-cols-2 md:gap-4 md:p-4"
	style="background: var(--bg); color: var(--text);"
>
	<!-- LEFT: Editor + toolbar -->
	<div class="flex h-[calc(50svh-0.75rem)] flex-col gap-2 md:h-[calc(100svh-2rem)]">
		<!-- Toolbar -->
		<div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
			<!-- Examples dropdown -->
			<select
				class="rounded border px-2 py-1 font-mono text-xs outline-none"
				style="background: var(--bg-panel); border-color: var(--border); color: var(--text);"
				on:change={(e) => { $source = e.target.value; e.target.value = ''; }}
			>
				<option value="">examples…</option>
				{#each examples as ex}
					<option value={ex.code}>{ex.label}</option>
				{/each}
			</select>

			<div class="flex-1"></div>

			<!-- AST export -->
			{#if result.parsed.nodes?.length > 0}
				<button
					class="rounded border px-2 py-1 hover:opacity-70"
					style="border-color: var(--border);"
					on:click={exportAST}
					title="Export AST as JSON"
				>
					AST ↓
				</button>
			{/if}

			<!-- Copy link -->
			<button
				class="rounded border px-2 py-1 hover:opacity-70"
				style="border-color: var(--border);"
				on:click={() => navigator.clipboard.writeText(window.location.href)}
				title="Copy shareable link"
			>
				⎘ link
			</button>

			<!-- Dark mode toggle -->
			<button
				class="rounded border px-2 py-1 hover:opacity-70"
				style="border-color: var(--border);"
				on:click={() => (dark = !dark)}
				title="Toggle dark mode"
			>
				{dark ? '☀' : '☾'}
			</button>
		</div>

		<!-- Editor -->
		<div class="flex-1 overflow-hidden">
			<Editor {result} {errorLine} {matchedBrackets} bind:cursorPos />
		</div>
	</div>

	<!-- RIGHT: Panels -->
	<div
		class="flex h-[calc(50svh-1.5rem)] flex-col gap-3 text-xs md:h-[calc(100vh-2rem)] md:gap-4 md:text-sm"
	>
		<!-- TOKENS -->
		<ul
			class="flex flex-col overflow-y-scroll rounded-md border p-4"
			style="height: 30%; background: var(--bg-panel); border-color: var(--border);"
		>
			<div class="mb-1 font-semibold">
				<span class={result.scanned.success ? 'text-emerald-500' : 'text-red-400'}>
					{result.scanned.success ? '[SCANNING SUCCESS]' : `[ERROR: ${result.scanned.msg}]`}
				</span>
			</div>
			<li class="mb-1 grid grid-cols-4 gap-3 font-semibold" style="color: var(--text);">
				<div>TYPE</div>
				<div>LEXEME</div>
				<div>LITERAL</div>
				<div>LINE</div>
			</li>
			<div class="mb-1 w-full border-t" style="border-color: var(--border-divider);"></div>
			{#each result.scanned.tokens.filter((t) => !['NEWLINE', 'SPACE'].includes(t.type)) as token}
				<li class="grid grid-cols-4 gap-3" style="color: var(--text-muted);">
					<div style="color: var(--text);">{token.type}</div>
					<div class="w-full overflow-x-clip">{token.lexeme}</div>
					<div>{token.literal ?? ''}</div>
					<div
						class={errorLine !== null && token.line === errorLine ? 'text-red-400 font-semibold' : ''}
					>{token.line}</div>
				</li>
			{/each}
		</ul>

		<!-- AST -->
		<div
			class="flex flex-col overflow-scroll rounded-md border p-4"
			style="height: 35%; background: var(--bg-panel); border-color: var(--border);"
		>
			<div class="mb-1 font-semibold">
				<span class={!result.parsed.error ? 'text-emerald-500' : 'text-red-400'}>
					{!result.parsed.error
						? '[PARSING SUCCESS]'
						: `[ERROR: ${result.parsed.error.split(',').at(0)}]`}
				</span>
			</div>
			<div class="w-max text-nowrap" style="color: var(--text);">
				{#if result.scanned.success && !result.parsed.error}
					{@html ASTtoString(result.parsed.nodes)}
				{/if}
			</div>
		</div>

		<!-- OUTPUT -->
		<div
			class="flex flex-col overflow-scroll rounded-md border p-4"
			style="height: 35%; background: var(--bg-panel); border-color: var(--border);"
		>
			<div class="mb-1 font-semibold">
				<span class={result.interpreted.error ? 'text-red-400' : 'text-emerald-500'}>
					{result.interpreted.error
						? `[RUNTIME ERROR: ${result.interpreted.error}]`
						: '[OUTPUT]'}
				</span>
			</div>
			{#if result.interpreted.output.length === 0 && !result.interpreted.error}
				<div style="color: var(--text-muted);">[no output]</div>
			{:else}
				{#each result.interpreted.output as line}
					<div style="color: var(--text);">{line}</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
