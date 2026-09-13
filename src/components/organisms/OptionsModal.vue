<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import useUser, { isMobileLandscape } from '@/use/useUser'
import { setI18nLocale } from '@/i18n'
import FModal from '@/components/molecules/FModal.vue'
import FButton from '@/components/atoms/FButton.vue'
import FSlider from '@/components/atoms/FSlider.vue'
import FSelect from '@/components/atoms/FSelect.vue'
import { LANGUAGES, LANGUAGE_AUTONYMS, DIFFICULTY } from '@/utils/enums'
import { hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/use/useHaptics'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Global scope so the Options UI strings resolve from the shared locale
// bundles (src/i18n/locales/*) — same source as the rest of the game.
const { t, locale }: any = useI18n({ useScope: 'global' })
const appI18n: any = (window as any).__i18n

const {
  setSettingValue,
  userLanguage,
  userDifficulty,
  userSoundVolume,
  userMusicVolume,
  userMusicTrack,
  userJuiceStyle,
  userHighVis,
  userSingleTap
} = useUser()

const currentTab = ref('general')

watch(userLanguage, async (newValue: string) => {
  if (appI18n) {
    await setI18nLocale(appI18n, newValue)
  } else {
    locale.value = newValue
  }
})

const isMobile = computed(() => {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
})

const tabs = computed(() => {
  const list = [
    { value: 'general', label: t('options.general') },
    // Always present, on every device. It carries the Juice Style selector,
    // which is the one setting in this game a PARENT might open the menu to
    // find — burying it behind a desktop-only tab would be the same as not
    // having it.
    { value: 'play', label: t('options.play') }
  ]
  return !isMobile.value ? list.concat({ label: t('options.audio'), value: 'audio' }) : list
})

// Native-name dropdown — every option legible regardless of the active locale.
const languagesList = computed(() =>
  LANGUAGES.map(loc => ({
    value: loc,
    label: LANGUAGE_AUTONYMS[loc] ?? loc
  }))
)

const difficultyList = computed(() => [
  { value: DIFFICULTY.EASY, label: t('options.difficulties.easy') },
  { value: DIFFICULTY.MEDIUM, label: t('options.difficulties.medium') },
  { value: DIFFICULTY.HARD, label: t('options.difficulties.hard') }
])

const difficultyHint = computed(() => t('options.difficultyHints.' + userDifficulty.value))

// Background-music track picker — Cozy Harmony (default) against Trance Tunnel.
const musicTrackList = computed(() => [
  { value: 'trance', label: t('options.musicTracks.trance') },
  { value: 'cozy', label: t('options.musicTracks.cozy') }
])

// ─── Vibration ──────────────────────────────────────────────────────────────
//
// `hapticsAvailable` is resolved once at module load and is false on every
// desktop and on every iPhone — `navigator.vibrate` is absent on iOS Safari
// entirely, and desktop Chrome ships it as a silent no-op. The row is therefore
// hidden rather than disabled: a settings control that provably cannot do
// anything on this device teaches the player that the settings lie.
//
// An `FSelect` rather than a bespoke switch, because every other control on
// this tab is one and the modal has no toggle atom — a one-off switch here
// would be the only control in the game that looks like that.
const hapticsList = computed(() => [
  { value: 'on', label: t('options.on') },
  { value: 'off', label: t('options.off') }
])

// ─── Tone and accessibility (GDD 2.2, 10.2) ─────────────────────────────────
//
// Three settings that change the PICTURE and never a number. Stated in the hint
// under the picker, because a parent scanning this screen for "can I turn the
// squishing down" needs to find the answer without playing the game — and a
// child who picks Confetti needs to know they have not made it easier.
const juiceStyleList = computed(() => [
  { value: 'ooze', label: t('options.juiceStyles.ooze') },
  { value: 'confetti', label: t('options.juiceStyles.confetti') },
  { value: 'bubble', label: t('options.juiceStyles.bubble') }
])

const juiceStyleHint = computed(() => t('options.juiceStyleHints.' + userJuiceStyle.value))

const onOffList = computed(() => [
  { value: 'on', label: t('options.on') },
  { value: 'off', label: t('options.off') }
])
</script>

<template lang="pug">
  FModal(
    :model-value="isOpen"
    :is-closable="false"
    :title="t('options.title')"
    :tabs="tabs"
    v-model:activeTab="currentTab"
    @update:model-value="emit('close')"
  )
    div(v-if="currentTab === 'general'")
      //- Landscape mobile lays the controls out in 2 columns so all of them
      //- (language, difficulty + hint, the two sliders, music track) fit the
      //- short viewport without the SAVE & CLOSE footer overlapping them.
      div(:class="isMobileLandscape ? 'grid grid-cols-2 gap-x-4 gap-y-1 p-1 items-start' : 'flex flex-col gap-2 p-2'")
        div(class="z-[20] flex flex-col gap-2")
          FSelect(
            :label="t('options.language')"
            :options="languagesList"
            :model-value="userLanguage"
            @update:model-value="setSettingValue('language', $event)"
          )
        div(class="z-[10] flex flex-col gap-1")
          FSelect(
            :label="t('options.difficulty')"
            :options="difficultyList"
            :model-value="userDifficulty"
            @update:model-value="setSettingValue('difficulty', $event)"
          )
          p.text-white.game-text.opacity-70.leading-tight.px-1(class="text-[10px] md:text-xs") {{ difficultyHint }}
        hr(v-if="!isMobileLandscape" class="border-slate-600 my-1 md:my-2 pt-0")
        FSlider.px-4(class="!py-1 !pb-3 w-full max-w-[min(20rem,90%)]" :model-value="userSoundVolume" @update:modelValue="setSettingValue('sound', $event)" :label="t('options.soundEffects')" :min="0" :max="1" :step="0.01")
        FSlider.px-4(class="!py-1 !pb-2 w-full max-w-[min(20rem,90%)]" :model-value="userMusicVolume" @update:modelValue="setSettingValue('music', $event)" :label="t('options.music')" :min="0" :max="1" :step="0.01")
        div(class="z-[5] flex flex-col gap-1")
          FSelect(
            :label="t('options.musicTrack')"
            :options="musicTrackList"
            :model-value="userMusicTrack"
            @update:model-value="setSettingValue('musicTrack', $event)"
          )
        //- Phones only, and it lives on the GENERAL tab rather than the audio
        //- one for a structural reason: `tabs` above drops the audio tab
        //- entirely on touch devices, so a vibration setting parked there would
        //- be reachable by exactly nobody who has a motor.
        //- Lowest z of the four dropdowns — it is the last one down the column,
        //- so its open list has to sit over nothing and under everything.
        div(v-if="hapticsAvailable" class="z-[1] flex flex-col gap-1")
          FSelect(
            :label="t('options.haptics')"
            :options="hapticsList"
            :model-value="hapticsEnabled ? 'on' : 'off'"
            @update:model-value="setHapticsEnabled($event === 'on')"
          )

    //- ── The play tab ────────────────────────────────────────────────────
    //- Everything that changes how the game LOOKS or how it is AIMED, and
    //- nothing that changes what it is worth.
    div(v-else-if="currentTab === 'play'")
      div(:class="isMobileLandscape ? 'grid grid-cols-2 gap-x-4 gap-y-1 p-1 items-start' : 'flex flex-col gap-2 p-2'")
        div(class="z-[20] flex flex-col gap-1")
          FSelect(
            :label="t('options.juiceStyle')"
            :options="juiceStyleList"
            :model-value="userJuiceStyle"
            @update:model-value="setSettingValue('juiceStyle', $event)"
          )
          p.text-white.game-text.opacity-70.leading-tight.px-1(class="text-[10px] md:text-xs") {{ juiceStyleHint }}
        div(class="z-[10] flex flex-col gap-1")
          FSelect(
            :label="t('options.highVis')"
            :options="onOffList"
            :model-value="userHighVis ? 'on' : 'off'"
            @update:model-value="setSettingValue('highVis', $event === 'on')"
          )
          p.text-white.game-text.opacity-70.leading-tight.px-1(class="text-[10px] md:text-xs") {{ t('options.highVisHint') }}
        div(class="z-[5] flex flex-col gap-1")
          FSelect(
            :label="t('options.singleTap')"
            :options="onOffList"
            :model-value="userSingleTap ? 'on' : 'off'"
            @update:model-value="setSettingValue('singleTap', $event === 'on')"
          )
          p.text-white.game-text.opacity-70.leading-tight.px-1(class="text-[10px] md:text-xs") {{ t('options.singleTapHint') }}

    div(v-else-if="currentTab === 'audio'").flex.flex-col.justify-between.items-center
      FSlider.px-4(class="!py-1 !pb-3 w-full max-w-[min(20rem,90%)]" :model-value="userSoundVolume" @update:modelValue="setSettingValue('sound', $event)" :label="t('options.soundEffects')" :min="0" :max="1" :step="0.01")
      FSlider.px-4(class="!py-1 !pb-2 w-full max-w-[min(20rem,90%)]" :model-value="userMusicVolume" @update:modelValue="setSettingValue('music', $event)" :label="t('options.music')" :min="0" :max="1" :step="0.01")
      div(class="z-[5] flex flex-col gap-1 w-full max-w-[min(20rem,100%)]")
        FSelect(
          :label="t('options.musicTrack')"
          :options="musicTrackList"
          :model-value="userMusicTrack"
          @update:model-value="setSettingValue('musicTrack', $event)"
        )
      hr(class="border-slate-600 my-1 md:my-2 pt-0")

    template(#footer)
      FButton(class="px-6 sm:px-8" @click="emit('close')") {{ t('options.close') }}
</template>

<style lang="sass" scoped>
span
  text-shadow: 2px 2px 0 #000
</style>
