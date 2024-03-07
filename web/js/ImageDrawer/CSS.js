import { $el } from "/scripts/ui.js";

$el("style", {
	textContent: `
	.JNodes-image-drawer--top, .JNodes-image-drawer--bottom {
		width: 100vw;
		min-height: 0px;
		max-height: calc(var(--max-size, 20) * 1vh);
	}
	.JNodes-image-drawer--top {
		top: 0;
	}
	.JNodes-image-drawer--bottom {
		bottom: 0;
		flex-direction: column-reverse;
		padding-top: 1px;
	}
	.JNodes-image-drawer--left, .JNodes-image-drawer--right {
		top: 0;
		height: 100vh;
		min-width: 100px;
		max-width: calc(var(--max-size, 10) * 1vw);
	}
	.JNodes-image-drawer--left {
		left: 0;
	}
	.JNodes-image-drawer--right {
		right: 0;
	}

	.JNodes-image-drawer--left .JNodes-image-drawer-menu, .JNodes-image-drawer--right .JNodes-image-drawer-menu {
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
	
	.JNodes-image-drawer-menu section {
		border-radius: 5px;
		background: rgba(0,0,0,0.6);
		padding: 0 5px;
		display: flex;
		gap: 5px;
		align-items: center;
		position: relative;
	}
	.JNodes-image-drawer-menu section span {
		white-space: nowrap;
		width: 100px;
	}
	.JNodes-image-drawer-menu section input {
		flex: 1 1 100%;
		background: rgba(0,0,0,0.6);
		border-radius: 5px;
		overflow: hidden;
		z-index: 100;
	}

	.sizing-menu {
		position: relative;
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
	.JNodes-image-drawer--bottom .size-controls-flyout  {
		transform: scale(1,0);
		transform-origin: bottom;
		bottom: 0;
		left: 0;
	}
	.JNodes-image-drawer--top .size-controls-flyout  {
		transform: scale(1,0);
		transform-origin: top;
		top: 0;
		left: 0;
	}
	.JNodes-image-drawer--left .size-controls-flyout  {
		transform: scale(0, 1);
		transform-origin: left;
		top: 0;
		left: 0;
	}
	.JNodes-image-drawer--right .size-controls-flyout  {
		transform: scale(0, 1);
		transform-origin: right;
		top: 0;
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
		grid-template-columns: repeat(var(--img-sz, 3), 1fr);
		transition: 100ms linear;
		scrollbar-gutter: stable both-edges;
		padding: 5px;
		background: var(--comfy-input-bg);
		border-radius: 5px;
		margin: 5px;
		margin-top: 0px;
		height: 90%;
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
    }`,
	parent: document.body,
});
