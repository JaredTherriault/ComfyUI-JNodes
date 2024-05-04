import { $el } from "/scripts/ui.js";

$el("style", {
	textContent: `
	.JNodes-image-drawer {
		position: absolute;
		background: var(--comfy-menu-bg);
		color: var(--fg-color);
		z-index: 99;
		font-family: sans-serif;
		font-size: 12px;
		display: flex;
		flex-direction: column;
		min-width: min-content;
		width: calc(var(--drawer-width, 20) * 1vw);
		min-height: max-content;
		height: calc(var(--drawer-height, 20) * 1vh);		
	}
	.JNodes-image-drawer--bottom-left,
	.JNodes-image-drawer--bottom-right {
		bottom: 0;
		flex-direction: column-reverse;
		padding-top: 1px;
	}
	.JNodes-image-drawer--top-left, 
	.JNodes-image-drawer--top-right {
		top: 0;
	}
	.JNodes-image-drawer--top-left,
	.JNodes-image-drawer--bottom-left {
		left: 0;
	}
	.JNodes-image-drawer--top-right,
	.JNodes-image-drawer--bottom-right {
		right: 0;
	}

	.JNodes-image-drawer-basic-controls-group {
		display: flex;
		gap: .5rem;
		flex: 0 1 fit-content;
	}

	.JNodes-image-drawer--top-left .JNodes-image-drawer-basic-controls-group,
	.JNodes-image-drawer--bottom-left .JNodes-image-drawer-basic-controls-group {
		align-items: left;
		justify-content: flex-start;
	}
	.JNodes-image-drawer--top-right .JNodes-image-drawer-basic-controls-group,
	.JNodes-image-drawer--bottom-right .JNodes-image-drawer-basic-controls-group {
		align-items: right;
		justify-content: flex-end;
	}

	.JNodes-image-drawer-menu {
		flex-direction: column;
	}
	
	.JNodes-image-drawer-btn {
		background-color:var(--comfy-input-bg);
		border-radius:5px;
		border:2px solid var(--border-color);
		color: var(--fg-color);
		cursor:pointer;
		display:inline-block;
		flex: 0 1 fit-content;
		text-decoration:none;
	}
	.JNodes-image-drawer-btn:hover {
		filter: brightness(1.2);
	}
	.JNodes-image-drawer-btn:active {
		position:relative;
		top:1px;
	}
	
	.flyout-handle,
	.flyout-menu {
		background: rgba(0,0,0,0.9);
		display: flex;
		gap: 5px;
		border-radius: 4px;
	}
	.flyout-handle {
		align-items: center;
		padding: 0 5px;
		position: relative;
	}
	.flyout-handle .flyout-menu tr {
		width: 100%
	}
	.flyout-handle .flyout-menu td {
		width: 100%
	}
	.flyout-handle tr span,
	.flyout-handle tr a {
		white-space: nowrap;
	}
	.flyout-handle tr input {
		flex: 1 1 100%;
		flex-direction: flex-start;
		border-radius: 5px;
		overflow: hidden;
		z-index: 100;
	}

	.flyout-handle .flyout-handle-label {
		width: max-content;
	}

	.flyout-menu {
		position: absolute;
		flex-direction: column;
		align-items: flex-start;
		z-index: 102;
		flex: 1 1 100%;
		padding: 100%;
		transform: scale(1,0);
		overflow-x: scroll;
		overflow-y: scroll;
		width: fit-content;
	}
	.flyout-handle:hover .flyout-menu {
		transform: scale(1,1);
		transition: 100ms linear;
		transition-delay: 0ms;
	}
	

	.flyout-menu.video-menu {
		align-items: flex-end;
	}
	
	.JNodes-interactive-container:hover {
		filter: brightness(2) drop-shadow(-1px -1px blue);
		cursor: 'pointer';
    }
	.JNodes-interactive-container:active {
		filter: brightness(2) drop-shadow(-1px -1px orange);
		cursor: 'pointer';
	}

	.JNodes-image-drawer-list {
		flex: 1 1 auto;
		overflow-y: scroll;
		display: grid;
		align-items: center;
		justify-content: center;
		gap: 4px;
		grid-auto-rows: min-content;
		grid-template-columns: repeat(var(--column-count, 3), 1fr);
		transition: 100ms linear;
		scrollbar-gutter: stable both-edges;
		padding: 5px;
		background: var(--comfy-input-bg);
		border-radius: 5px;
		margin: 5px;
		margin-top: 0px;
	}
	.JNodes-image-drawer-list:empty {
		display: none;
	}
	.JNodes-image-drawer-list::-webkit-scrollbar {
		background: var(--comfy-input-bg);
		border-radius: 5px;
	}
	.JNodes-image-drawer-list::-webkit-scrollbar-thumb {
		background:var(--comfy-menu-bg);
		border: 5px solid transparent;
		border-radius: 8px;
		background-clip: content-box;
		color: rgb(255,255,255);
	}
	.JNodes-image-drawer-list::-webkit-scrollbar-thumb:hover {
		background: var(--border-color);
		background-clip: content-box;
	}
	.JNodes-image-drawer-list div:hover {
		filter: brightness(1.05);
    }
	.JNodes-image-drawer-list .imageElement img,
	.JNodes-image-drawer-list .imageElement video {
		width: 100%;
	}`,
	parent: document.body,
});
