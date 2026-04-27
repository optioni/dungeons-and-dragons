<template>
    <div class="flex items-center justify-center my-8 select-none"
        aria-hidden="true">
        <svg width="180"
            height="18"
            viewBox="0 0 180 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="opacity-35">
            <!-- Left rule -->
            <line x1="0"
                y1="9"
                x2="68"
                y2="9"
                stroke="currentColor"
                stroke-width="0.75"
                class="text-grimoire-accent-dim" />
            <!-- Left diamond -->
            <rect x="70"
                y="5"
                width="8"
                height="8"
                transform="rotate(45 74 9)"
                fill="none"
                stroke="currentColor"
                stroke-width="0.75"
                class="text-grimoire-accent" />
            <!-- Centre star -->
            <path d="M90 4 L91.5 8.5 L96 9 L91.5 9.5 L90 14 L88.5 9.5 L84 9 L88.5 8.5 Z"
                fill="currentColor"
                class="text-grimoire-accent" />
            <!-- Right diamond -->
            <rect x="102"
                y="5"
                width="8"
                height="8"
                transform="rotate(45 106 9)"
                fill="none"
                stroke="currentColor"
                stroke-width="0.75"
                class="text-grimoire-accent" />
            <!-- Right rule -->
            <line x1="112"
                y1="9"
                x2="180"
                y2="9"
                stroke="currentColor"
                stroke-width="0.75"
                class="text-grimoire-accent-dim" />
        </svg>
    </div>
</template>
