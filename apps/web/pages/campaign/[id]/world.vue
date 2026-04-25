<template>
    <div class="min-h-screen grimoire-bg grimoire-ui p-4 md:p-6">
        <!-- Navigation -->
        <div class="max-w-6xl mx-auto mb-8 relative z-10 grimoire-page-enter">
            <div class="flex items-center gap-4">
                <nuxt-link
                    :to="`/campaign/${campaignId}/play`"
                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                >
                    ← Play
                </nuxt-link>

                <div class="flex gap-5 ml-auto">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        Quests
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/world`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent"
                    >
                        World
                    </nuxt-link>
                </div>
            </div>
        </div>

        <div class="max-w-7xl mx-auto space-y-8 relative z-10">
            <header class="border-b border-grimoire-accent-dim/25 pb-5">
                <h1 class="font-['IM_Fell_English',serif] text-5xl text-grimoire-text">World Overview</h1>

                <p class="font-['Cinzel',serif] text-xs tracking-[0.24em] uppercase text-grimoire-text/75 mt-2">
                    Map, factions, diary, and active omens
                </p>
            </header>

            <div class="space-y-8">
                <!-- World Map Section (primary) -->
                    <section class="space-y-4">
                        <div class="flex items-center justify-between flex-wrap gap-3 border-b border-grimoire-accent-dim/25 pb-3">
                            <div class="max-w-xl">
                                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.3em] uppercase text-grimoire-text/80">Known Map</h2>

                                <p class="font-['IM_Fell_English',serif] text-base leading-relaxed text-grimoire-text/80 mt-1">
                                    {{ mapSummary }}
                                </p>
                            </div>

                            <!-- Scale switcher -->
                            <div class="flex gap-2">
                                <button
                                    v-for="scale in availableScales"
                                    :key="scale"
                                    type="button"
                                    class="min-h-9 border px-3 font-['Cinzel',serif] text-xs tracking-widest uppercase transition-colors"
                                    :class="selectedScale === scale
                                        ? 'border-grimoire-accent bg-grimoire-accent/15 text-grimoire-accent'
                                        : 'border-grimoire-accent-dim/40 text-grimoire-text/80 hover:border-grimoire-accent-dim hover:text-grimoire-text'"
                                    @click="setScale(scale)"
                                >
                                    {{ scale }}
                                </button>
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-x-4 gap-y-2 text-grimoire-text/80">
                            <span
                                v-for="item in mapLegend"
                                :key="item.label"
                                class="inline-flex items-center gap-2 font-['Cinzel',serif] text-[0.68rem] tracking-wider uppercase"
                            >
                                <span
                                    class="h-3 w-3 rounded-full border"
                                    :class="item.markerClass"
                                />

                                {{ item.label }}
                            </span>
                        </div>

                        <!-- Fixed-height map container to prevent panel shift on scale changes -->
                        <div class="relative w-full aspect-video overflow-hidden border border-grimoire-accent-dim/30 bg-grimoire-raised shadow-xl">
                            <div class="absolute inset-0 bg-grimoire-accent/5 pointer-events-none" />

                            <div v-if="mapFetching"
                                class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-grimoire-text">
                                <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />

                                <p class="font-['IM_Fell_English',serif] italic text-xl">Charting the realm...</p>
                            </div>

                            <div
                                v-else-if="!worldMap || (worldMap.discoveredNodes.length === 0 && worldMap.frontierNodes.length === 0)"
                                class="absolute inset-0 flex items-center justify-center"
                            >
                                <p class="font-['IM_Fell_English',serif] italic text-grimoire-text text-xl">No map data for this scale yet.</p>
                            </div>

                            <world-map-graph
                                v-else
                                class="relative z-10 w-full h-full"
                                :discovered-nodes="worldMap.discoveredNodes"
                                :frontier-nodes="worldMap.frontierNodes"
                                :edges="worldMap.edges"
                                :current-location-id="worldMap.currentLocationId"
                                :previous-node-ids="previousNodeIds"
                                aria-label="Campaign world map"
                                @node-select="onMapNodeSelect"
                            />
                        </div>
                    </section>

                    <!-- Diary Entries -->
                    <section class="space-y-4">
                        <h2 class="font-['Cinzel',serif] text-xs tracking-[0.3em] uppercase text-grimoire-text/80 border-b border-grimoire-accent-dim/25 pb-3">Diary</h2>

                        <div v-if="diaryFetching"
                            class="flex flex-col items-center gap-3 py-6 text-grimoire-text">
                            <span class="w-2.5 h-2.5 rounded-full bg-grimoire-accent grimoire-breathe" />

                            <p class="font-['IM_Fell_English',serif] italic text-lg">Turning diary pages...</p>
                        </div>

                        <div v-else-if="!recentDiary.length"
                            class="font-['IM_Fell_English',serif] italic text-grimoire-text/75 py-6 text-lg leading-relaxed">
                            No diary entries yet.
                        </div>

                        <div v-else
                            class="space-y-3">
                            <!-- Diary search -->
                            <div class="pb-2">
                                <u-input
                                    v-model="diarySearch"
                                    placeholder="Search diary…"
                                    size="sm"
                                    icon="i-lucide-search"
                                />
                            </div>

                            <div
                                v-for="entry in filteredRecentDiary"
                                :key="entry.id"
                                class="bg-grimoire-surface border-l-2 border-grimoire-accent-dim/70 p-5"
                            >
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent">{{ entry.inGameDate }}</span>

                                    <u-badge
                                        v-if="entry.entryType === 'MEMORIAL'"
                                        color="error"
                                        variant="soft"
                                        size="xs"
                                    >
                                        Memorial
                                    </u-badge>
                                </div>

                                <p
                                    class="font-['IM_Fell_English',serif] text-xl leading-relaxed text-grimoire-text"
                                    :class="descriptionExpanded(`diary-${entry.id}`) ? '' : 'max-h-24 overflow-hidden'"
                                >
                                    {{ entry.content }}
                                </p>

                                <button
                                    type="button"
                                    class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                    @click="toggleDescription(`diary-${entry.id}`)"
                                >
                                    {{ descriptionExpanded(`diary-${entry.id}`) ? 'Show less' : 'Read more' }}
                                </button>
                            </div>

                            <!-- Older entries collapsed section -->
                            <template v-if="filteredOlderDiary.length || diaryPageInfo?.hasNextPage">
                                <div class="pt-2">
                                    <u-button
                                        variant="ghost"
                                        color="neutral"
                                        size="sm"
                                        class="w-full"
                                        @click="showOlderDiary = !showOlderDiary"
                                    >
                                        {{ showOlderDiary ? 'Hide older entries' : 'Show older entries' }}
                                    </u-button>
                                </div>

                                <template v-if="showOlderDiary">
                                    <div
                                        v-for="entry in filteredOlderDiary"
                                        :key="entry.id"
                                        class="bg-grimoire-surface/80 border-l-2 border-grimoire-accent-dim/40 p-5"
                                    >
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-text/70">{{ entry.inGameDate }}</span>
                                        </div>

                                        <p
                                            class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text"
                                            :class="descriptionExpanded(`diary-${entry.id}`) ? '' : 'max-h-20 overflow-hidden'"
                                        >
                                            {{ entry.content }}
                                        </p>

                                        <button
                                            type="button"
                                            class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                            @click="toggleDescription(`diary-${entry.id}`)"
                                        >
                                            {{ descriptionExpanded(`diary-${entry.id}`) ? 'Show less' : 'Read more' }}
                                        </button>
                                    </div>

                                    <div v-if="diaryPageInfo?.hasNextPage"
                                        class="flex justify-center pt-1">
                                        <u-button
                                            variant="soft"
                                            color="neutral"
                                            size="sm"
                                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase"
                                            :loading="diaryLoadingMore"
                                            @click="loadMoreDiary"
                                        >
                                            Load more diary entries
                                        </u-button>
                                    </div>
                                </template>
                            </template>
                        </div>
                    </section>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <!-- Active World Events -->
                    <section class="space-y-4">
                        <h2 class="font-['Cinzel',serif] text-xs tracking-[0.3em] uppercase text-grimoire-text/80 border-b border-grimoire-accent-dim/25 pb-3">Active World Events</h2>

                        <div v-if="eventsFetching"
                            class="flex flex-col items-center gap-3 py-6 text-grimoire-text">
                            <span class="w-2.5 h-2.5 rounded-full bg-grimoire-accent grimoire-breathe" />

                            <p class="font-['IM_Fell_English',serif] italic text-lg">Reading active omens...</p>
                        </div>

                        <div v-else-if="!worldEvents.length"
                            class="font-['IM_Fell_English',serif] italic text-grimoire-text/75 py-6 text-lg leading-relaxed">
                            No active world events.
                        </div>

                        <div v-else
                            class="space-y-2">
                            <button
                                v-for="event in worldEvents"
                                :key="event.id"
                                type="button"
                                class="group w-full bg-grimoire-surface border border-grimoire-accent-dim/25 rounded-sm px-4 py-3 text-left transition-colors hover:border-grimoire-accent-dim/70 hover:bg-grimoire-accent/10 focus:outline-none focus:ring-2 focus:ring-grimoire-accent/50"
                                @click="openWorldEventModal(event.id)"
                            >
                                <div class="flex items-start gap-3">
                                    <u-badge
                                        color="warning"
                                        variant="soft"
                                        size="xs"
                                        class="mt-1"
                                    >
                                        {{ event.status }}
                                    </u-badge>

                                    <div class="min-w-0 flex-1">
                                        <p class="font-['IM_Fell_English',serif] text-lg leading-snug text-grimoire-text">
                                            {{ eventTitle(event.description) }}
                                        </p>

                                        <p v-if="event.deadlineInGameDate"
                                            class="mt-1 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-text/65">
                                            Deadline: {{ event.deadlineInGameDate }}
                                        </p>
                                    </div>

                                    <u-icon name="i-lucide-chevron-right" class="w-4 h-4 text-grimoire-accent opacity-50 transition-opacity group-hover:opacity-100 shrink-0 mt-0.5" />
                                </div>
                            </button>
                        </div>
                    </section>

                    <!-- Factions -->
                    <section class="space-y-4">
                        <h2 class="font-['Cinzel',serif] text-xs tracking-[0.3em] uppercase text-grimoire-text/80 border-b border-grimoire-accent-dim/25 pb-3">Factions</h2>

                        <div v-if="factionsFetching"
                            class="flex flex-col items-center gap-3 py-6 text-grimoire-text">
                            <span class="w-2.5 h-2.5 rounded-full bg-grimoire-accent grimoire-breathe" />

                            <p class="font-['IM_Fell_English',serif] italic text-lg">Reading faction ledgers...</p>
                        </div>

                        <div v-else-if="!factions.length"
                            class="font-['IM_Fell_English',serif] italic text-grimoire-text/75 py-6 text-lg leading-relaxed">
                            No factions known yet.
                        </div>

                        <div v-else
                            class="space-y-2">
                            <button
                                v-for="faction in factions"
                                :key="faction.id"
                                type="button"
                                class="group w-full bg-grimoire-surface border border-grimoire-accent-dim/25 rounded-sm px-4 py-3 text-left transition-colors hover:border-grimoire-accent-dim/70 hover:bg-grimoire-accent/10 focus:outline-none focus:ring-2 focus:ring-grimoire-accent/50"
                                @click="openFactionModal(faction.id)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="min-w-0 flex-1">
                                        <p class="font-['IM_Fell_English',serif] text-xl leading-tight text-grimoire-text">{{ faction.name }}</p>

                                        <p class="mt-1 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-text/65">
                                            <span v-if="faction.powerLevel != null">Power {{ faction.powerLevel }}/10</span>
                                        </p>
                                    </div>

                                    <u-badge
                                        v-if="faction.playerDisposition && isShortBadgeText(faction.playerDisposition)"
                                        :color="dispositionColor(faction.playerDisposition)"
                                        variant="soft"
                                        size="xs"
                                    >
                                        {{ faction.playerDisposition }}
                                    </u-badge>

                                    <u-icon name="i-lucide-chevron-right" class="w-4 h-4 text-grimoire-accent opacity-50 transition-opacity group-hover:opacity-100 shrink-0 mt-0.5" />
                                </div>
                            </button>
                        </div>
                    </section>

                    <!-- NPC Roster -->
                    <section class="space-y-4">
                        <h2 class="font-['Cinzel',serif] text-xs tracking-[0.3em] uppercase text-grimoire-text/80 border-b border-grimoire-accent-dim/25 pb-3">Known NPCs</h2>

                        <div v-if="npcsFetching"
                            class="flex flex-col items-center gap-3 py-6 text-grimoire-text">
                            <span class="w-2.5 h-2.5 rounded-full bg-grimoire-accent grimoire-breathe" />

                            <p class="font-['IM_Fell_English',serif] italic text-lg">Listening for familiar names...</p>
                        </div>

                        <div v-else-if="!npcs.length"
                            class="font-['IM_Fell_English',serif] italic text-grimoire-text/75 py-6 text-lg leading-relaxed">
                            No NPCs encountered yet.
                        </div>

                        <div v-else
                            class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                            <button
                                v-for="npc in npcs"
                                :key="npc.id"
                                type="button"
                                class="group w-full text-left bg-grimoire-surface border border-grimoire-accent-dim/25 rounded-sm px-4 py-3 hover:border-grimoire-accent-dim/70 hover:bg-grimoire-accent/10 transition-colors focus:outline-none focus:ring-2 focus:ring-grimoire-accent/50"
                                @click="openNpcModal(npc.id)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="min-w-0 flex-1">
                                        <p class="font-['IM_Fell_English',serif] text-xl leading-tight text-grimoire-text">{{ npc.name }}</p>

                                        <p v-if="npc.profession"
                                            class="mt-1 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-text/65">
                                            {{ npc.profession }}
                                        </p>

                                        <div v-if="npc.disposition && isShortBadgeText(npc.disposition) || (npc.partyStatus && npc.partyStatus !== 'NONE') || !npc.alive"
                                            class="mt-1.5 flex flex-wrap gap-1.5">
                                            <u-badge
                                                v-if="npc.disposition && isShortBadgeText(npc.disposition)"
                                                :color="dispositionColor(npc.disposition)"
                                                variant="soft"
                                                size="xs"
                                            >
                                                {{ npc.disposition }}
                                            </u-badge>

                                            <u-badge
                                                v-if="npc.partyStatus && npc.partyStatus !== 'NONE'"
                                                color="success"
                                                variant="soft"
                                                size="xs"
                                            >
                                                {{ npc.partyStatus }}
                                            </u-badge>

                                            <u-badge
                                                v-if="!npc.alive"
                                                color="error"
                                                variant="soft"
                                                size="xs"
                                            >
                                                Deceased
                                            </u-badge>
                                        </div>
                                    </div>

                                    <u-icon name="i-lucide-chevron-right" class="w-4 h-4 text-grimoire-accent opacity-50 transition-opacity group-hover:opacity-100 shrink-0 mt-0.5" />
                                </div>
                            </button>

                            <div v-if="npcsPageInfo?.hasNextPage"
                                class="flex justify-center pt-2 sm:col-span-2 xl:col-span-1">
                                <u-button
                                    variant="soft"
                                    color="neutral"
                                    size="sm"
                                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase"
                                    :loading="npcsLoadingMore"
                                    @click="loadMoreNpcs"
                                >
                                    Load more NPCs
                                </u-button>
                            </div>
                        </div>
                    </section>
                </div>
        </div>

        <!-- World Event Modal -->
        <u-modal v-model:open="worldEventModalOpen">
            <template #content>
                <div class="max-h-[calc(100vh-4rem)] overflow-y-auto bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-5 text-grimoire-text">
                    <div class="flex items-start justify-between gap-4 border-b border-grimoire-accent-dim/20 pb-3 mb-4">
                        <div>
                            <h3 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">{{ selectedWorldEvent ? eventTitle(selectedWorldEvent.description) : 'World Event' }}</h3>

                            <p v-if="selectedWorldEvent?.deadlineInGameDate"
                                class="mt-1 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-text/65">
                                Deadline: {{ selectedWorldEvent.deadlineInGameDate }}
                            </p>
                        </div>

                        <u-button
                            icon="i-lucide-x"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            @click="worldEventModalOpen = false"
                        />
                    </div>

                    <div v-if="selectedWorldEvent"
                        class="space-y-4">
                        <u-badge
                            color="warning"
                            variant="soft"
                        >
                            {{ selectedWorldEvent.status }}
                        </u-badge>

                        <p class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text">
                            {{ selectedWorldEvent.description }}
                        </p>
                    </div>
                </div>
            </template>
        </u-modal>

        <!-- Faction Detail Modal -->
        <u-modal v-model:open="factionModalOpen">
            <template #content>
                <div class="max-h-[calc(100vh-4rem)] overflow-y-auto bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-5 text-grimoire-text">
                    <div class="flex items-start justify-between gap-4 border-b border-grimoire-accent-dim/20 pb-3 mb-4">
                        <div>
                            <h3 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">{{ selectedFaction?.name ?? 'Faction' }}</h3>

                            <p v-if="selectedFaction?.powerLevel != null"
                                class="mt-1 font-mono text-xs text-grimoire-text/70">
                                Power {{ selectedFaction.powerLevel }}/10
                            </p>
                        </div>

                        <u-button
                            icon="i-lucide-x"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            @click="factionModalOpen = false"
                        />
                    </div>

                    <div v-if="selectedFaction"
                        class="space-y-4">
                        <div v-if="selectedFaction.playerDisposition">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Standing</span>

                            <p class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text">
                                {{ selectedFaction.playerDisposition }}
                            </p>
                        </div>

                        <div v-if="selectedFaction.goals">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Goals</span>

                            <p class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text">
                                {{ selectedFaction.goals }}
                            </p>
                        </div>

                        <div v-if="selectedFaction.territory">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Territory</span>

                            <p class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text">
                                {{ selectedFaction.territory }}
                            </p>
                        </div>
                    </div>
                </div>
            </template>
        </u-modal>

        <!-- NPC Profile Modal -->
        <u-modal v-model:open="npcModalOpen">
            <template #content>
                <div class="max-h-[calc(100vh-4rem)] overflow-y-auto bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-5 text-grimoire-text">
                    <div class="flex items-center justify-between border-b border-grimoire-accent-dim/20 pb-3 mb-4">
                        <h3 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">{{ selectedNpc?.name ?? 'NPC Profile' }}</h3>

                        <u-button
                            icon="i-lucide-x"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            @click="npcModalOpen = false"
                        />
                    </div>

                    <div v-if="npcProfileFetching"
                        class="flex flex-col items-center gap-3 py-8 text-grimoire-muted">
                        <span class="w-2.5 h-2.5 rounded-full bg-grimoire-accent grimoire-breathe" />

                        <p class="font-['IM_Fell_English',serif] italic">Opening the dossier...</p>
                    </div>

                    <div v-else-if="selectedNpc"
                        class="space-y-4">
                        <div class="flex flex-wrap gap-2">
                            <u-badge
                                v-if="selectedNpc.profession"
                                color="neutral"
                                variant="soft"
                            >
                                {{ selectedNpc.profession }}
                            </u-badge>

                            <u-badge
                                v-if="selectedNpc.disposition && isShortBadgeText(selectedNpc.disposition)"
                                :color="dispositionColor(selectedNpc.disposition)"
                                variant="soft"
                            >
                                {{ selectedNpc.disposition }}
                            </u-badge>

                            <u-badge
                                v-if="selectedNpc.partyStatus && selectedNpc.partyStatus !== 'NONE'"
                                color="success"
                                variant="soft"
                            >
                                {{ selectedNpc.partyStatus }}
                            </u-badge>
                        </div>

                        <div v-if="selectedNpc.disposition && !isShortBadgeText(selectedNpc.disposition)">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Disposition</span>

                            <p
                                class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text"
                                :class="descriptionExpanded(`npc-disposition-${selectedNpc.id}`) ? '' : 'max-h-20 overflow-hidden'"
                            >
                                {{ selectedNpc.disposition }}
                            </p>

                            <button
                                type="button"
                                class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                @click="toggleDescription(`npc-disposition-${selectedNpc.id}`)"
                            >
                                {{ descriptionExpanded(`npc-disposition-${selectedNpc.id}`) ? 'Show less' : 'Read more' }}
                            </button>
                        </div>

                        <div v-if="selectedNpc.description">
                            <p
                                class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text"
                                :class="descriptionExpanded(`npc-description-${selectedNpc.id}`) ? '' : 'max-h-20 overflow-hidden'"
                            >
                                {{ selectedNpc.description }}
                            </p>

                            <button
                                type="button"
                                class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                @click="toggleDescription(`npc-description-${selectedNpc.id}`)"
                            >
                                {{ descriptionExpanded(`npc-description-${selectedNpc.id}`) ? 'Show less' : 'Read more' }}
                            </button>
                        </div>

                        <div v-if="selectedNpc.coreMotivation"
                            class="text-base">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Motivation</span>

                            <p
                                class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text"
                                :class="descriptionExpanded(`npc-motivation-${selectedNpc.id}`) ? '' : 'max-h-20 overflow-hidden'"
                            >
                                {{ selectedNpc.coreMotivation }}
                            </p>

                            <button
                                type="button"
                                class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                @click="toggleDescription(`npc-motivation-${selectedNpc.id}`)"
                            >
                                {{ descriptionExpanded(`npc-motivation-${selectedNpc.id}`) ? 'Show less' : 'Read more' }}
                            </button>
                        </div>

                        <div v-if="selectedNpc.speechStyle"
                            class="text-base">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-1">Speech Style</span>

                            <p
                                class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text italic"
                                :class="descriptionExpanded(`npc-speech-${selectedNpc.id}`) ? '' : 'max-h-20 overflow-hidden'"
                            >
                                {{ selectedNpc.speechStyle }}
                            </p>

                            <button
                                type="button"
                                class="mt-2 font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                @click="toggleDescription(`npc-speech-${selectedNpc.id}`)"
                            >
                                {{ descriptionExpanded(`npc-speech-${selectedNpc.id}`) ? 'Show less' : 'Read more' }}
                            </button>
                        </div>

                        <div v-if="selectedNpc.relationships?.length"
                            class="text-base">
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider block mb-2">Relationships</span>

                            <div class="space-y-1">
                                <div
                                    v-for="rel in selectedNpc.relationships"
                                    :key="rel.id"
                                    class="space-y-1 text-sm"
                                >
                                    <div class="flex items-center gap-2">
                                        <u-badge
                                            color="neutral"
                                            variant="soft"
                                            size="xs"
                                        >
                                            {{ rel.type }}
                                        </u-badge>

                                        <span class="font-['IM_Fell_English',serif] text-lg text-grimoire-text">{{ relationshipTargetName(rel.targetNpcId) }}</span>
                                    </div>

                                    <template v-if="rel.description">
                                        <p
                                            class="font-['IM_Fell_English',serif] text-lg leading-relaxed text-grimoire-text"
                                            :class="descriptionExpanded(`npc-relation-${rel.id}`) ? '' : 'max-h-20 overflow-hidden'"
                                        >
                                            {{ rel.description }}
                                        </p>

                                        <button
                                            type="button"
                                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent hover:text-grimoire-text transition-colors"
                                            @click="toggleDescription(`npc-relation-${rel.id}`)"
                                        >
                                            {{ descriptionExpanded(`npc-relation-${rel.id}`) ? 'Show less' : 'Read more' }}
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </u-modal>

        <!-- Travel Confirmation Dialog -->
        <u-modal v-model:open="travelDialogOpen">
            <template #content>
                <div class="max-h-[calc(100vh-4rem)] overflow-y-auto bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-5 text-grimoire-text">
                    <div class="flex items-center justify-between border-b border-grimoire-accent-dim/20 pb-3 mb-4">
                        <h3 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">Travel to {{ travelDestination?.name }}</h3>

                        <u-button
                            icon="i-lucide-x"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            @click="travelDialogOpen = false"
                        />
                    </div>

                    <p class="font-['IM_Fell_English',serif] text-base text-grimoire-text/85 mb-4">
                        Set out for <strong class="text-grimoire-accent">{{ travelDestination?.name }}</strong>?
                        The DM will narrate the journey, handle any encounters, and update your location.
                    </p>

                    <div v-if="travelError"
                        class="mb-4 p-3 rounded bg-red-900/50 border border-red-700 text-red-300 text-sm">
                        {{ travelError }}
                    </div>

                    <div class="flex gap-3 justify-end">
                        <u-button
                            variant="soft"
                            color="neutral"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase"
                            @click="travelDialogOpen = false"
                        >
                            Cancel
                        </u-button>

                        <u-button
                            color="primary"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase"
                            :loading="travelLoading"
                            @click="confirmTravel"
                        >
                            Travel
                        </u-button>
                    </div>
                </div>
            </template>
        </u-modal>
    </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue';
import { type ResultOf } from 'gql.tada';

import {
    ACTIVE_SESSION_QUERY,
    SEND_PLAYER_INPUT_MUTATION,
    START_SESSION_MUTATION,
} from '~/graphql/session';
import {
    FACTIONS_QUERY,
    NPCS_QUERY,
    NPC_PROFILE_QUERY,
    DIARY_ENTRIES_QUERY,
    WORLD_EVENTS_QUERY,
    WORLD_MAP_QUERY,
} from '~/graphql/world';

// ── Types ──────────────────────────────────────────────────────────────────

type WorldMapData = ResultOf<typeof WORLD_MAP_QUERY>['worldMap'];
type MapScale = WorldMapData['selectedScale'];
type NpcRosterItem = ResultOf<typeof NPCS_QUERY>['npcs']['edges'][number]['node'];
type NpcProfile = ResultOf<typeof NPC_PROFILE_QUERY>['npc'];
type DiaryEntry = ResultOf<typeof DIARY_ENTRIES_QUERY>['diaryEntries']['edges'][number]['node'];
type Faction = ResultOf<typeof FACTIONS_QUERY>['factions']['edges'][number]['node'];
type WorldEvent = ResultOf<typeof WORLD_EVENTS_QUERY>['worldEvents']['edges'][number]['node'];

// ── Route ─────────────────────────────────────────────────────────────────

const route = useRoute();
const router = useRouter();
const campaignId = computed(() => route.params.id as string);

// ── World Map ─────────────────────────────────────────────────────────────

const selectedScale = ref<MapScale>('WORLD');
const worldMap = ref<WorldMapData | null>(null);
const previousNodeIds = ref<Set<string>>(new Set<string>());

const { data: mapData, fetching: mapFetching, executeQuery: refetchMap } = useQuery({
    query: WORLD_MAP_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, scale: selectedScale.value })),
    requestPolicy: 'network-only',
});

watch(mapData, (data) => {
    if (!data?.worldMap) return;

    // Capture current visible ids BEFORE updating for animation diffing
    if (worldMap.value) {
        const currentIds = new Set<string>();
        for (const n of worldMap.value.discoveredNodes) currentIds.add(n.id);
        for (const n of worldMap.value.frontierNodes) currentIds.add(n.id);
        previousNodeIds.value = currentIds;
    }

    worldMap.value = data.worldMap;
}, { immediate: true });

const availableScales = computed<MapScale[]>(() => worldMap.value?.availableScales ?? []);

const mapSummary = computed(() => {
    if (!worldMap.value) return 'The chart is still being prepared.';

    const discovered = worldMap.value.discoveredNodes.length;
    const frontier = worldMap.value.frontierNodes.length;
    const current = worldMap.value.discoveredNodes.find((node) => node.id === worldMap.value?.currentLocationId);
    const locationText = current ? ` Current location: ${current.name}.` : '';

    return `${discovered} known ${discovered === 1 ? 'place' : 'places'} and ${frontier} veiled ${frontier === 1 ? 'route' : 'routes'}.${locationText}`;
});

const currentLocationName = computed(() =>
    worldMap.value?.discoveredNodes.find((node) => node.id === worldMap.value?.currentLocationId)?.name ?? 'Unknown',
);

const mapLegend = [
    { label: 'Current', markerClass: 'border-grimoire-accent bg-transparent ring-2 ring-grimoire-accent/70' },
    { label: 'Frontier', markerClass: 'border-grimoire-text/60 bg-grimoire-raised' },
    { label: 'Activity', markerClass: 'border-grimoire-bg bg-grimoire-accent' },
    { label: 'Safe', markerClass: 'border-grimoire-text/60 bg-emerald-900' },
    { label: 'Tense', markerClass: 'border-grimoire-text/60 bg-yellow-800' },
    { label: 'Hostile', markerClass: 'border-grimoire-text/60 bg-red-900' },
];

const expandedDescriptions = ref<Set<string>>(new Set<string>());

function descriptionExpanded(id: string): boolean {
    return expandedDescriptions.value.has(id);
}

function toggleDescription(id: string): void {
    const next = new Set(expandedDescriptions.value);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    expandedDescriptions.value = next;
}

function setScale(scale: MapScale): void {
    if (scale === selectedScale.value) return;
    // Capture current node ids before scale switch so no animation replays
    if (worldMap.value) {
        const ids = new Set<string>();
        for (const n of worldMap.value.discoveredNodes) ids.add(n.id);
        for (const n of worldMap.value.frontierNodes) ids.add(n.id);
        previousNodeIds.value = ids;
    }
    selectedScale.value = scale;
}

// Refetch map when returning from play (route change detection)
onActivated(() => {
    void refetchMap({ requestPolicy: 'network-only' });
});

// ── Travel Flow ───────────────────────────────────────────────────────────

const travelDialogOpen = ref(false);
const travelDestination = ref<{ id: string; name: string } | null>(null);
const travelLoading = ref(false);
const travelError = ref<string | null>(null);

const { data: activeSessionData } = useQuery({
    query: ACTIVE_SESSION_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value })),
});

const { executeMutation: startSessionMutation } = useMutation(START_SESSION_MUTATION);
const { executeMutation: sendPlayerInputMutation } = useMutation(SEND_PLAYER_INPUT_MUTATION);

function onMapNodeSelect(nodeId: string, name: string): void {
    // Prevent travel to current location
    if (nodeId === worldMap.value?.currentLocationId) return;
    travelDestination.value = { id: nodeId, name };
    travelError.value = null;
    travelDialogOpen.value = true;
}

async function confirmTravel(): Promise<void> {
    if (!travelDestination.value || travelLoading.value) return;
    travelError.value = null;
    travelLoading.value = true;

    try {
        // Resolve or start an active session
        let sessionId = activeSessionData.value?.activeSession?.id ?? null;

        if (!sessionId) {
            const sessionResult = await startSessionMutation({ campaignId: campaignId.value });
            if (sessionResult.error || !sessionResult.data?.startSession) {
                travelError.value = 'Could not start a session. Please try again.';
                return;
            }
            sessionId = sessionResult.data.startSession.id;
        }

        // Send the travel input through the DM session flow
        const inputResult = await sendPlayerInputMutation({
            sessionId,
            text: `Travel to ${travelDestination.value.name}.`,
        });

        if (inputResult.error) {
            travelError.value = 'Failed to submit travel request. Please try again.';
            return;
        }

        travelDialogOpen.value = false;
        // Navigate to play so the DM stream narrates the journey
        await router.push(`/campaign/${campaignId.value}/play`);
    } finally {
        travelLoading.value = false;
    }
}

// ── Factions ──────────────────────────────────────────────────────────────

const { data: factionsData, fetching: factionsFetching } = useQuery({
    query: FACTIONS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 50 })),
});

const factions = computed(() =>
    (factionsData.value?.factions?.edges ?? []).map((edge) => edge.node),
);

const factionModalOpen = ref(false);
const selectedFactionId = ref<string | null>(null);
const selectedFaction = computed<Faction | null>(() =>
    factions.value.find((faction) => faction.id === selectedFactionId.value) ?? null,
);

function openFactionModal(id: string): void {
    selectedFactionId.value = id;
    factionModalOpen.value = true;
}

// ── NPCs ──────────────────────────────────────────────────────────────────

const npcsAfter = ref<string | null>(null);
const allNpcs = ref<NpcRosterItem[]>([]);
const npcsPageInfo = ref<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
const npcsLoadingMore = ref(false);

const { data: npcsData, fetching: npcsFetching } = useQuery({
    query: NPCS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 20 })),
});

watch(npcsData, (data) => {
    if (!data) return;
    const edges = data.npcs?.edges ?? [];
    allNpcs.value = edges.map((edge) => edge.node);
    npcsPageInfo.value = data.npcs?.pageInfo ?? null;
}, { immediate: true });

const npcs = computed(() => allNpcs.value);

async function loadMoreNpcs(): Promise<void> {
    if (!npcsPageInfo.value?.endCursor || npcsLoadingMore.value) return;
    npcsLoadingMore.value = true;
    npcsAfter.value = npcsPageInfo.value.endCursor;
    npcsLoadingMore.value = false;
}

// ── NPC Profile Modal ─────────────────────────────────────────────────────

const npcModalOpen = ref(false);
const selectedNpcId = ref<string | null>(null);
const selectedNpc = ref<NpcProfile | null>(null);

const { data: npcProfileData, fetching: npcProfileFetching } = useQuery({
    query: NPC_PROFILE_QUERY,
    variables: computed(() => ({ id: selectedNpcId.value })),
    pause: computed(() => !selectedNpcId.value),
});

watch(npcProfileData, (data) => {
    if (data?.npc) {
        selectedNpc.value = data.npc;
    }
}, { immediate: true });

function openNpcModal(id: string): void {
    selectedNpcId.value = id;
    npcModalOpen.value = true;
}

function relationshipTargetName(targetNpcId: string | number): string {
    const targetId = String(targetNpcId);
    return npcs.value.find((npc) => String(npc.id) === targetId)?.name ?? 'Unknown contact';
}

// ── Diary ─────────────────────────────────────────────────────────────────

const DIARY_RECENT_COUNT = 7;
const allDiaryEntries = ref<DiaryEntry[]>([]);
const diaryPageInfo = ref<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
const showOlderDiary = ref(false);
const diaryLoadingMore = ref(false);
const diarySearch = ref('');
const diaryAfter = ref<string | null>(null);
const diaryAppending = ref(false);

const { data: diaryData, fetching: diaryFetching, executeQuery: refetchDiary } = useQuery({
    query: DIARY_ENTRIES_QUERY,
    variables: computed(() => ({
        campaignId: campaignId.value,
        first: 20,
        after: diaryAfter.value,
    })),
});

watch(diaryData, (data) => {
    if (!data) return;
    const edges = data.diaryEntries?.edges ?? [];
    const entries = edges.map((edge) => edge.node);
    allDiaryEntries.value = diaryAppending.value
        ? [...allDiaryEntries.value, ...entries]
        : entries;
    diaryPageInfo.value = data.diaryEntries?.pageInfo ?? null;
    diaryAppending.value = false;
}, { immediate: true });

const filteredDiaryEntries = computed(() => {
    const q = diarySearch.value.trim().toLowerCase();
    if (!q) return allDiaryEntries.value;
    return allDiaryEntries.value.filter(
        (e) => e.content.toLowerCase().includes(q) || e.inGameDate.toLowerCase().includes(q),
    );
});

const recentDiary = computed(() => allDiaryEntries.value.slice(0, DIARY_RECENT_COUNT));
const filteredRecentDiary = computed(() => filteredDiaryEntries.value.slice(0, DIARY_RECENT_COUNT));
const filteredOlderDiary = computed(() => filteredDiaryEntries.value.slice(DIARY_RECENT_COUNT));

async function loadMoreDiary(): Promise<void> {
    if (!diaryPageInfo.value?.endCursor || diaryLoadingMore.value) return;
    diaryLoadingMore.value = true;
    diaryAppending.value = true;
    diaryAfter.value = diaryPageInfo.value.endCursor;

    try {
        await refetchDiary({ requestPolicy: 'network-only' });
    } finally {
        diaryLoadingMore.value = false;
    }
}

// ── World Events ──────────────────────────────────────────────────────────

const { data: eventsData, fetching: eventsFetching } = useQuery({
    query: WORLD_EVENTS_QUERY,
    variables: computed(() => ({
        campaignId: campaignId.value,
        status: 'ACTIVE',
        first: 50,
    })),
});

const worldEvents = computed(() =>
    (eventsData.value?.worldEvents?.edges ?? []).map((edge) => edge.node),
);

const worldEventModalOpen = ref(false);
const selectedWorldEventId = ref<string | null>(null);
const selectedWorldEvent = computed<WorldEvent | null>(() =>
    worldEvents.value.find((event) => event.id === selectedWorldEventId.value) ?? null,
);

function openWorldEventModal(id: string): void {
    selectedWorldEventId.value = id;
    worldEventModalOpen.value = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isShortBadgeText(value: string): boolean {
    return value.length <= 28;
}

function eventTitle(description: string): string {
    const [title] = description.split(/\s+[—-]\s+/, 1);
    return title.length > 0 ? title : description.slice(0, 72);
}

function dispositionColor(disposition: string): 'success' | 'warning' | 'error' | 'neutral' {
    const lower = disposition.toLowerCase();
    if (['friendly', 'ally', 'companion', 'warm'].some((w) => lower.includes(w))) return 'success';
    if (['hostile', 'enemy', 'wary', 'bitter'].some((w) => lower.includes(w))) return 'error';
    if (['neutral'].some((w) => lower.includes(w))) return 'neutral';
    return 'warning';
}
</script>
