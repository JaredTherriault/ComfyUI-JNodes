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
		min-height: min-content;
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
	.JNodes-image-drawer-btn.sizing-btn:checked {
		filter: invert();
	}
	.JNodes-image-drawer-btn:hover {
		filter: brightness(1.2);
	}
	.JNodes-image-drawer-btn:active {
		position:relative;
		top:1px;
	}
	
	.JNodes-image-drawer-menu section,
	.JNodes-image-drawer-menu tr {
		background: rgba(0,0,0,0.9);
		padding: 0 5px;
		display: flex;
		gap: 5px;
		align-items: center;
		position: relative;
	}
	.JNodes-image-drawer-menu section {
		border-radius: 15px;
	}
	.JNodes-image-drawer-menu tr {
		border-radius: 2px;
	}
	.JNodes-image-drawer-menu td {
		width: 50%
	}
	.JNodes-image-drawer-menu section span {
		white-space: nowrap;
	}
	.JNodes-image-drawer-menu section input {
		flex: 1 1 100%;
		border-radius: 5px;
		overflow: hidden;
		z-index: 100;
	}

	.sizing-menu {
		position: relative;
	}

	.sizing-menu .size-control-handle {
		width: max-content;
	}

	.size-controls-flyout {
		position: absolute;
		transform: scaleX(0%);
		transition: 200ms ease-out;
		transition-delay: 500ms;
		z-index: 102;
		width: 300px;
	}

	.sizing-menu:hover .size-controls-flyout {
		transform: scale(1, 1);
		transition: 200ms linear;
		transition-delay: 0;
	}
	.JNodes-image-drawer--top-left .size-controls-flyout,
	.JNodes-image-drawer--top-right .size-controls-flyout  {
		transform: scale(1,0);
		transform-origin: top;
		top: 0;
	}
	.JNodes-image-drawer--top-left .size-controls-flyout  {
		left: 0;
	}
	.JNodes-image-drawer--top-right .size-controls-flyout  {
		right: 0;
	}
	.JNodes-image-drawer--bottom-left .size-controls-flyout,
	.JNodes-image-drawer--bottom-right .size-controls-flyout  {
		transform: scale(1,0);
		transform-origin: bottom;
		bottom: 0;
	}
	.JNodes-image-drawer--bottom-left .size-controls-flyout  {
		left: 0;
	}
	.JNodes-image-drawer--bottom-right .size-controls-flyout  {
		right: 0;
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
