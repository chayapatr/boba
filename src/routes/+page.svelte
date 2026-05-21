<script lang="ts">
	// @ts-nocheck
	import { BOBA } from '$lib';
	import type { ASTNode } from '$lib/boba/parser/generator';
	import { createStepper } from '$lib/boba/interpreter/stepper';
	import type { Stepper, StepFrame } from '$lib/boba/interpreter/stepper';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';
	import { onMount } from 'svelte';

	$: result = BOBA($source);

	// ── Dark mode ────────────────────────────────────────────────
	let dark = true;
	$: if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('dark', dark);
	}

	// ── Shareable URL ────────────────────────────────────────────
	onMount(() => {
		const hash = window.location.hash.slice(1);
		if (hash) {
			try { $source = decodeURIComponent(hash); } catch {}
		}

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && debugMode) { e.preventDefault(); stopDebug(); }
			if (e.key === ' ' && debugMode && !autoPlaying) { e.preventDefault(); stepForward(); }
			if (e.key === 'ArrowRight' && debugMode && !autoPlaying) { e.preventDefault(); stepForward(); }
			if (e.key === 'ArrowLeft' && debugMode && !autoPlaying) { e.preventDefault(); stepBack(); }
		});
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
		},
		{
			label: 'Functions',
			code: 'fun greet(name) {\n  return "hello, " + name + "!";\n}\nprint greet("world");\nprint greet("boba");'
		},
		{
			label: 'Arrays',
			code: 'let a = [10, 20, 30];\nprint a[0];\na[1] = 99;\nprint a[1];\nlet i = 0;\nwhile (i < 3) {\n  print a[i];\n  i = i + 1;\n}'
		},
		{
			label: 'Recursion',
			code: 'fun fib(n) {\n  if (n <= 1) {\n    return n;\n  }\n  return fib(n - 1) + fib(n - 2);\n}\nprint fib(10);'
		}
	];

	// ── Debugger ─────────────────────────────────────────────────
	let debugMode = false;
	let stepper: Stepper | null = null;
	let history: StepFrame[] = [];
	let historyIndex = -1;
	let autoPlaying = false;
	let autoInterval: ReturnType<typeof setInterval> | null = null;

	$: stepFrame = history[historyIndex] ?? null;

	const startDebug = () => {
		if (!result.parsed.nodes?.length) return;
		stepper = createStepper(result.parsed.nodes);
		history = [];
		historyIndex = -1;
		debugMode = true;
		autoPlaying = false;
		stepOnce(); // advance to first frame
	};

	const stopDebug = () => {
		debugMode = false;
		stepper = null;
		history = [];
		historyIndex = -1;
		stopAuto();
	};

	const stepOnce = () => {
		if (!stepper || stepper.isDone) return;
		const frame = stepper.step();
		// if we're not at the end of history, truncate forward
		history = [...history.slice(0, historyIndex + 1), frame];
		historyIndex = history.length - 1;
	};

	const seekTo = (i: number) => {
		historyIndex = Math.max(0, Math.min(i, history.length - 1));
	};

	const stepBack = () => seekTo(historyIndex - 1);
	const stepForward = () => {
		if (historyIndex < history.length - 1) seekTo(historyIndex + 1);
		else stepOnce();
	};

	const stopAuto = () => {
		if (autoInterval !== null) { clearInterval(autoInterval); autoInterval = null; }
		autoPlaying = false;
	};

	const toggleAuto = () => {
		if (autoPlaying) { stopAuto(); return; }
		autoPlaying = true;
		autoInterval = setInterval(() => {
			if (!stepper || stepper.isDone) { stopAuto(); return; }
			stepOnce();
		}, 180);
	};

	// Reset debugger when source changes
	$: if ($source) stopDebug();

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
	// Color categories matching GitHub syntax theme
	const astColor = (category: 'stmt' | 'ctrl' | 'expr' | 'literal' | 'fn' | 'dim') => {
		const map = {
			stmt:    'var(--syn-print)',      // orange — statements (print, var, assign)
			ctrl:    'var(--syn-keyword)',    // red — control flow (if, while, return)
			expr:    'var(--syn-identifier)', // blue — expressions (binary, unary, call)
			literal: 'var(--syn-string)',     // blue-ish — literals and variable names
			fn:      'var(--syn-function)',   // purple — fun declarations
			dim:     'var(--text-muted)',     // muted — structural (group, block)
		};
		return map[category];
	};

	const ASTtoString = (nodes: ASTNode[], activeType?: string): string => {
		if (!nodes || nodes.length === 0) return '';

		const col = (cat: 'stmt' | 'ctrl' | 'expr' | 'literal' | 'fn' | 'dim', text: string, highlight = false) => {
			const color = astColor(cat);
			const bg = highlight ? 'background:var(--bg);outline:1px solid currentColor;border-radius:2px;padding:0 2px;' : '';
			return `<span style="color:${color};${bg}">${text}</span>`;
		};

		const dfs = (node: ASTNode, prefix: string, parentActive = false): string => {
			const n = node as Record<string, unknown>;
			const active = activeType !== undefined && n.type === activeType;
			const ind = prefix;
			const next = prefix + '&nbsp;&nbsp;';

			switch (n.type as string) {
				case 'LITERAL':
					return `<br/>${ind}⊢ ${col('literal', `${n.expr}`, active)}`;
				case 'BINARY':
					return `<br/>${ind}⊢ ${col('expr', `${(n.opr as Token).lexeme}`, active)}${dfs(n.left as ASTNode, next)}${dfs(n.right as ASTNode, next)}`;
				case 'GROUPING':
					return `<br/>${ind}⊢ ${col('dim', '(…)', active)}${dfs(n.expr as ASTNode, next)}`;
				case 'UNARY':
					return `<br/>${ind}⊢ ${col('expr', `${(n.opr as Token).lexeme}`, active)}${dfs(n.right as ASTNode, next)}`;
				case 'VARIABLE':
					return `<br/>${ind}⊢ ${col('literal', `${(n.name as Token).lexeme}`, active)}`;
				case 'ASSIGN':
					return `<br/>${ind}⊢ ${col('stmt', `${n.name} =`, active)}${dfs(n.value as ASTNode, next)}`;
				case 'EXPRESSION':
					return dfs(n.expr as ASTNode, ind, active);
				case 'PRINT':
					return `<br/>${ind}⊢ ${col('stmt', 'print', active)}${dfs(n.expr as ASTNode, next)}`;
				case 'VAR':
					return `<br/>${ind}⊢ ${col('stmt', `let ${n.name}`, active)}${n.expr ? dfs(n.expr as ASTNode, next) : ''}`;
				case 'IF':
					return (
						`<br/>${ind}⊢ ${col('ctrl', 'if', active)}${dfs(n.condition as ASTNode, next)}` +
						`<br/>${ind}&nbsp;&nbsp;${col('ctrl', 'then')}${(n.then as ASTNode[]).map((s) => dfs(s, next + '&nbsp;&nbsp;')).join('')}` +
						(n.else ? `<br/>${ind}&nbsp;&nbsp;${col('ctrl', 'else')}${(n.else as ASTNode[]).map((s) => dfs(s, next + '&nbsp;&nbsp;')).join('')}` : '')
					);
				case 'WHILE':
					return (
						`<br/>${ind}⊢ ${col('ctrl', 'while', active)}${dfs(n.condition as ASTNode, next)}` +
						`<br/>${ind}&nbsp;&nbsp;${col('ctrl', 'body')}${(n.body as ASTNode[]).map((s) => dfs(s, next + '&nbsp;&nbsp;')).join('')}`
					);
				case 'BLOCK':
					return (n.body as ASTNode[]).map((s) => dfs(s, ind)).join('');
				case 'FUN':
					return `<br/>${ind}⊢ ${col('fn', `fun ${n.name}(${(n.params as string[]).join(', ')})`, active)}${(n.body as ASTNode[]).map((s) => dfs(s, next)).join('')}`;
				case 'RETURN':
					return `<br/>${ind}⊢ ${col('ctrl', 'return', active)}${n.value ? dfs(n.value as ASTNode, next) : ''}`;
				case 'CALL':
					return `<br/>${ind}⊢ ${col('expr', `call ${((n.callee as Record<string,unknown>).name as Token)?.lexeme ?? '…'}`, active)}${(n.args as ASTNode[]).map((a) => dfs(a, next)).join('')}`;
				case 'ARRAY':
					return `<br/>${ind}⊢ ${col('literal', '[…]', active)}${(n.elements as ASTNode[]).map((e) => dfs(e, next)).join('')}`;
				case 'INDEX':
					return `<br/>${ind}⊢ ${col('expr', 'index', active)}${dfs(n.object as ASTNode, next)}${dfs(n.index as ASTNode, next)}`;
				case 'INDEX_ASSIGN':
					return `<br/>${ind}⊢ ${col('stmt', 'index =', active)}${dfs(n.object as ASTNode, next)}${dfs(n.index as ASTNode, next)}${dfs(n.value as ASTNode, next)}`;
				default:
					return `<br/>${ind}⊢ ${col('dim', n.type as string, active)}`;
			}
		};

		return `<span style="color:var(--text-muted);font-weight:600;">PROGRAM</span>` + nodes.map((n) => dfs(n, '')).join('');
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

			<!-- Debug mode -->
			{#if result.parsed.nodes?.length > 0 && !debugMode}
				<button
					class="rounded border px-2 py-1 hover:opacity-70"
					style="border-color: var(--border); color: var(--syn-print);"
					on:click={startDebug}
					title="Start step-through debugger"
				>
					▷ debug
				</button>
			{/if}
			{#if debugMode}
				<button
					class="rounded border px-2 py-1 hover:opacity-70 disabled:opacity-30"
					style="border-color: var(--border); color: var(--syn-print);"
					on:click={stepBack}
					disabled={historyIndex <= 0}
				>◁</button>
				<button
					class="rounded border px-2 py-1 hover:opacity-70 disabled:opacity-30"
					style="border-color: var(--border); color: var(--syn-print);"
					on:click={stepForward}
					disabled={stepper?.isDone && historyIndex >= history.length - 1}
				>▷</button>
				<button
					class="rounded border px-2 py-1 hover:opacity-70"
					style="border-color: var(--border); color: {autoPlaying ? 'var(--syn-keyword)' : 'var(--text-muted)'};"
					on:click={toggleAuto}
				>{autoPlaying ? '⏸' : '▶▶'}</button>
				<span style="color: var(--text-muted);" class="text-xs tabular-nums">
					{historyIndex + 1}/{history.length}{stepper?.isDone ? '' : '+'}
				</span>
				<button
					class="rounded border px-2 py-1 hover:opacity-70"
					style="border-color: var(--border); color: var(--text-muted);"
					on:click={stopDebug}
				>✕</button>
			{/if}

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
				<span style="color: {result.scanned.success ? 'var(--syn-function)' : 'var(--syn-keyword)'}">
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
						style={errorLine !== null && token.line === errorLine ? `color: var(--syn-keyword); font-weight: 600;` : ''}
					>{token.line}</div>
				</li>
			{/each}
		</ul>

		<!-- AST -->
		<div
			class="flex flex-col overflow-scroll rounded-md border p-4"
			style="height: 35%; background: var(--bg-panel); border-color: var(--border);"
		>
			<div class="mb-1 font-semibold flex items-center gap-2">
				<span style="color: {!result.parsed.error ? 'var(--syn-function)' : 'var(--syn-keyword)'}">
					{!result.parsed.error
						? '[PARSING SUCCESS]'
						: `[ERROR: ${result.parsed.error.split(',').at(0)}]`}
				</span>
				{#if debugMode && stepFrame && !stepFrame.done}
					<span style="color: var(--syn-print);" class="text-xs">▶ {stepFrame.label}</span>
				{/if}
			</div>
			<div class="w-max text-nowrap" style="color: var(--text);">
				{#if result.scanned.success && !result.parsed.error}
					{@html ASTtoString(result.parsed.nodes, debugMode && stepFrame ? stepFrame.nodeType : undefined)}
				{/if}
			</div>
		</div>

		<!-- OUTPUT / DEBUG -->
		{#if debugMode && stepFrame}
			<!-- Debug panels -->
			<div class="flex flex-col gap-2 overflow-hidden" style="height: 35%;">
				<!-- Scrubber -->
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0"
						max={history.length - 1}
						value={historyIndex}
						on:input={(e) => seekTo(parseInt(e.target.value))}
						class="flex-1"
						style="accent-color: var(--syn-print);"
					/>
					<span class="tabular-nums text-xs" style="color: var(--text-muted); min-width: 4ch; text-align:right;">
						{historyIndex + 1}
					</span>
				</div>

				<!-- Scope + Output side by side -->
				<div class="flex flex-1 gap-2 overflow-hidden min-h-0">
					<!-- Call stack + Scope -->
					<div
						class="flex flex-1 flex-col overflow-scroll rounded-md border p-3"
						style="background: var(--bg-panel); border-color: var(--border);"
					>
						<!-- Call stack -->
						{#if stepFrame.callStack.length > 0}
							<div class="mb-2">
								<div class="mb-1 font-semibold text-xs" style="color: var(--syn-function);">[STACK]</div>
								{#each [...stepFrame.callStack].reverse() as frame, i}
									<div class="mb-1">
										<div style="color: var(--syn-function);">{frame.name}()</div>
										{#each Object.entries(frame.args) as [k, v]}
											<div class="grid grid-cols-2 gap-1 pl-2" style="color: var(--text-muted);">
												<span style="color: var(--syn-identifier);">{k}</span>
												<span style="color: var(--text);">{v}</span>
											</div>
										{/each}
									</div>
								{/each}
								<div class="my-1 border-t" style="border-color: var(--border-divider);"></div>
							</div>
						{/if}
						<!-- Scope -->
						<div class="mb-1 font-semibold text-xs" style="color: var(--syn-print);">
							[SCOPE{stepFrame.done ? ' · done' : ''}]
						</div>
						{#if Object.keys(stepFrame.scope).length === 0}
							<div style="color: var(--text-muted);">[empty]</div>
						{:else}
							{#each Object.entries(stepFrame.scope) as [name, val]}
								<div class="grid grid-cols-2 gap-1">
									<span style="color: var(--syn-identifier);">{name}</span>
									<span style="color: var(--text);">{val}</span>
								</div>
							{/each}
						{/if}
						{#if stepFrame.error}
							<div class="mt-2" style="color: var(--syn-keyword);">[ERROR: {stepFrame.error}]</div>
						{/if}
					</div>
					<!-- Output so far -->
					<div
						class="flex flex-1 flex-col overflow-scroll rounded-md border p-3"
						style="background: var(--bg-panel); border-color: var(--border);"
					>
						<div class="mb-1 font-semibold text-xs" style="color: var(--syn-function);">[OUTPUT]</div>
						{#if stepFrame.output.length === 0}
							<div style="color: var(--text-muted);">[no output yet]</div>
						{:else}
							{#each stepFrame.output as line}
								<div style="color: var(--text);">{line}</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Normal output -->
			<div
				class="flex flex-col overflow-scroll rounded-md border p-4"
				style="height: 35%; background: var(--bg-panel); border-color: var(--border);"
			>
				<div class="mb-1 font-semibold">
					<span style="color: {result.interpreted.error ? 'var(--syn-keyword)' : 'var(--syn-function)'};">
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
		{/if}
	</div>
</div>
