// Per-project settings for `pnpm deploy:poki`.
//
// `team` and `gameId` come straight out of the P4D URL of the game's Versions
// page:
//   https://app.poki.dev/<team>/games/<gameId>/versions

export default {
  team: 'hyperg8',
  gameName: 'Bug Crunch',

  /** Deliberately NOT set yet. Left out, the pipeline finds the game by
   *  `gameName` on `https://app.poki.dev/<team>` and prints the id it resolved
   *  — paste it here afterwards to skip that page load on later runs.
   *
   *  Worth leaving unset until the first successful lookup: a wrong uuid typed
   *  in here uploads to another game silently, where a wrong NAME throws and
   *  lists what the sidebar actually offers. */
  // gameId: '',

  /** The project's OWN build script, always — never a hand-written
   *  `vite build --mode poki …` copied in here. The mode and base flags belong
   *  to `build:poki`, and a second copy of them in this file stops matching the
   *  day that script changes.
   *
   *  `build:poki` ends with `cd dist && tar -a -cf ../bug-crunch-poki.zip * &&
   *  cd .. && move bug-crunch-poki.zip dist\\`. That tail is HARMLESS here: it
   *  writes into `dist`, `repack` excludes `.zip` from the archive it builds,
   *  and the same path is then overwritten with a real zip. */
  build: 'pnpm build:poki',
  dist: 'dist',
  zip: 'dist/bug-crunch-poki.zip',

  /** Pack `dist` ourselves rather than trusting the build script's
   *  `tar -a -cf`, which silently produces a TAR named `.zip` whenever GNU tar
   *  wins the PATH — and this machine runs the Bash tool on Git Bash, so it
   *  does. Leave this on. */
  repack: true,

  /** Extra files to keep out of the upload (backups and nested zips are
   *  already excluded).
   *
   *  `-original.*` is the compress-images pipeline's backup convention. Those
   *  siblings live next to the compressed asset and would otherwise ship the
   *  uncompressed copy of every image inside the portal zip. */
  zipExclude: (path) => /-original\.(png|jpe?g|webp)$/i.test(path),

  /** What the version is called in P4D. Keep the version number in it — it is
   *  the only thing tying a live build back to a commit. */
  versionName: version => `Bug Crunch ${version}`,

  /** Extra hosts the gates and the runtime sweep should accept.
   *
   *  EMPTY, and it should stay empty. Poki forbids every external runtime
   *  request, which is why this build ships `VITE_LEADERBOARD_URL` empty and
   *  bakes the seeded board into the bundle instead of fetching one. A host
   *  appearing here later means something started making a request that the
   *  Poki build is not allowed to make. */
  allowHosts: [],

  qa: {
    playMs: 45000,          // how long the harness actually plays before judging
    adWaitMs: 120000,       // how long to wait for a commercial break
  },

  /** Surfaces this game actually has. They decide whether a checklist step is
   *  "not applicable" or a real question.
   *
   *  `usernames: false` is checked, not assumed: nothing in `src/` calls
   *  `setPlayerName`, there is no name-entry UI, and on Poki there is no SDK
   *  identity either — so the board name is always the anonymous mint
   *  (`Wanderer483105`). Nobody can type a name, and on this build nobody can
   *  post one to a board anyone else reads: the leaderboard is the baked
   *  seeded copy and is read-only. If a name field is ever added, flip this and
   *  the profanity-filter step stops being n/a. */
  declares: {
    usernames: false,
    chat: false,
  },

  /** Expressions evaluated INSIDE the game's iframe during the QA pass. */
  hooks: {
    /** A snapshot that must survive a reload. Key names plus value lengths,
     *  rather than values: a timestamp or a session id changes on every boot
     *  and would fail a save that is working perfectly.
     *
     *  For this game that covers `bugcrunch_state` (the one save blob) and the
     *  standalone `bug-crunch_uid` / `bug-crunch_name` identity keys, which are
     *  deliberately outside the cloud-synced `bc_` prefix. */
    readProgress: `(() => {
      const skip = /^(poki_|inspector-|_ga|debug|fps)/
      const out = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || skip.test(k)) continue
        out[k] = (localStorage.getItem(k) || '').length
      }
      return out
    })()`,

    /** NULL for now, so the rewarded step is reported as UNPROVEN rather than
     *  silently ticked on nothing.
     *
     *  The game does have a rewarded flow — `LockerModal.vue` pays for a shoe
     *  with a rewarded video — but it is behind a modal and a readiness gate,
     *  and reaching it is a DOM sequence rather than a call. Wiring a
     *  QA-only entry point into shipped code is a deliberate decision, not
     *  something to slip in for a checkbox; see the note in the run report. */
    triggerRewarded: null,
  },
}
