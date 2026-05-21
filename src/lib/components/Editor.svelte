<script lang="ts">
	import { beautify } from '$lib';
	import { source } from '$lib/store';
	import { onMount } from 'svelte';

	export let result;
	export let errorLine: number | null = null;
	export let matchedBrackets: [number, number] | null = null;
	export let cursorPos = 0;

	let editor: HTMLDivElement;
	let textarea: HTMLTextAreaElement;
	let editorHeight: number;

	onMount(() => {
		editorHeight = editor?.clientHeight;
		document.addEventListener('keydown', () => {
			requestAnimationFrame(() => { editorHeight = editor?.clientHeight; });
			setTimeout(() => {
				requestAnimationFrame(() => {
					const n = editor?.clientHeight;
					if (n !== editorHeight) editorHeight = n;
				});
			}, 300);
		});
	});

	const updateCursor = () => {
		cursorPos = textarea?.selectionStart ?? 0;
	};

	// Compute which display lines have error underline or bracket highlight
	// We work in token-line space for error, char-offset space for brackets
	$: lines = beautify(result.scanned.tokens);

	// For bracket matching: map char offsets to [lineIndex, colStart, colEnd] ranges
	// We re-scan source to find positions of each char in each line
	$: bracketHighlights = (() => {
		if (!matchedBrackets) return new Set<number>();
		const src = $source;
		const [a, b] = matchedBrackets;
		// convert char offsets to line numbers (0-indexed)
		const lineOf = (offset: number) => src.slice(0, offset).split('\n').length - 1;
		return new Set([lineOf(a), lineOf(b)]);
	})();
</script>

<div
	class="flex h-full overflow-y-scroll rounded-md border py-4 pl-2 pr-4 font-mono text-sm md:text-base"
	style="background: var(--bg-panel); border-color: var(--border);"
>
	<div class="relative h-full w-full">
		<div class="relative" bind:this={editor}>
			{#each lines as line, i}
				<div
					class="flex divide-x"
					style="border-color: var(--border-divider);
					       {errorLine !== null && i + 1 === errorLine ? 'text-decoration: underline wavy var(--syn-keyword); text-underline-offset: 3px;' : ''}
					       {bracketHighlights.has(i) ? 'background: rgba(250,204,21,0.15);' : ''}"
				>
					<div
						class="w-6 pr-2 text-right md:w-12"
						style="color: {errorLine !== null && i + 1 === errorLine ? 'var(--syn-keyword)' : 'var(--text-muted)'};"
					>
						{i + 1}
					</div>
					<div class="pl-[7px] md:pl-[15px]" style="width: calc(100% - 48px);">
						{#if typeof line === 'string'}
							<div class="w-full break-all">{@html line.split('%break%').join('<br/>')}</div>
						{:else}
							<br />
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div
			class="absolute left-0 top-0 w-full pl-8 md:pl-16"
			style={`height: max(100%, ${(editorHeight ?? 0) + 16}px);`}
		>
			<textarea
				bind:this={textarea}
				class="h-full w-full overflow-y-hidden break-all bg-transparent font-mono outline-none"
				style={`color: ${result.scanned.tokens.length <= 0 || !result.scanned.success ? 'rgba(150,150,150,0.4)' : 'transparent'}; caret-color: var(--caret); resize: none`}
				bind:value={$source}
				on:keyup={updateCursor}
				on:mouseup={updateCursor}
				on:click={updateCursor}
			></textarea>
		</div>
	</div>
</div>
