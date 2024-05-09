<script lang="ts">
	import { BOBA, beautify } from '$lib';
	import { source } from '$lib/store';
	import { onMount } from 'svelte';

	export let result;
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
						editorHeight = n;
					}
				});
			}, 300);
		});
	});
</script>

<div
	class="flex h-full overflow-y-scroll rounded-md border border-y bg-gray-50 py-4 pl-2 pr-4 font-mono text-sm md:text-base"
>
	<div class="relative h-full w-full">
		<div class="relative" bind:this={editor}>
			{#each beautify(result.tokens) as line, i}
				<div class="flex divide-x divide-neutral-500">
					<div
						class="w-6 pr-2 text-right text-neutral-600 md:w-12
            "
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
			style={`height: max(100%, ${editorHeight + 16}px);`}
		>
			<textarea
				class="h-full w-full overflow-y-hidden break-all bg-transparent font-mono outline-none"
				style={`color: ${result.tokens.length <= 0 || !result.success ? 'rgba(100,100,100,0.3)' : 'transparent'}; caret-color: #666; resize: none`}
				bind:value={$source}
			></textarea>
		</div>
	</div>
</div>
