<script lang="ts">
	import { TEA, beautify } from '$lib';
	import { onMount } from 'svelte';

	export let source;
	let editor: HTMLDivElement;
	let editorHeight: number;
	onMount(() => {
		editorHeight = editor?.clientHeight;
		document.addEventListener('keydown', (e) => {
			requestAnimationFrame(() => {
				editorHeight = editor?.clientHeight;
			});
			setTimeout(() => {
				requestAnimationFrame(() => {
					const n = editor?.clientHeight;
					if (n !== editorHeight) {
						console.log('gotcha!', n);
						editorHeight = n;
					}
				});
			}, 300);
		});
	});

	$: tokens = TEA($source).tokens || [];
</script>

<div class="flex h-full overflow-y-scroll rounded-md border-y bg-gray-800 py-4 pl-2 pr-4 font-mono">
	<div class="relative h-full w-full">
		<div class="relative" bind:this={editor}>
			{#each beautify(tokens) as line, i}
				<div class="flex divide-x divide-neutral-500">
					<div
						class="w-[48px] pr-2 text-right text-neutral-500
            "
					>
						{i + 1}
					</div>
					<div class="pl-[15px]" style="width: calc(100% - 48px);">
						{#if line === ''}
							<br />
						{:else}
							<div class="w-full break-all">{@html line}</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
		<div
			class="absolute left-0 top-0 w-full pl-16"
			style={`height: max(100%, ${editorHeight + 16}px);`}
		>
			<textarea
				class="h-full w-full overflow-y-hidden break-all bg-transparent font-mono outline-none"
				style={`color: ${tokens.length <= 0 || !TEA($source).success ? '#bbb' : 'transparent'}; caret-color: #bbb; resize: none`}
				bind:value={$source}
			></textarea>
		</div>
	</div>
</div>
