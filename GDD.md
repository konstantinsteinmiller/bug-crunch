# GAME DESIGN DOCUMENT (GDD)
# **SPLATIX**
*Target Audience: Ages 6–15 | Genre: Top-Down 2D Action / Arcade Stomper | Platform: Mobile (iOS/Android), PC, Nintendo Switch*

---

## 1. Executive Summary & Core Concept

### 1.1 Elevator Pitch
**SPLATIX** is a high-energy, 2D top-down arcade action game where players control a giant foot/shoe overhead to stomp, slide, and squish swarms of quirky cartoon bugs and squishy targets. Built around the satisfying tactile feedback of vivid splash animations and punchy audio design, *SPLATFOOT* expands simple bug-squishing into a deep, engaging arcade experience featuring reactive enemy AI, customizable footwear loadouts, combo mechanics, and interactive stage hazards.

### 1.2 Core Pillars
1. **Sensory Juice & Tactile Satisfaction**: Every stomp delivers visual, audio, and haptic feedback. Vibrant multi-colored goo, popping eye-balls, screen-shake, and comic-book visual effects make squishing irresistible.
2. **Dynamic Stomp Combat**: Moving beyond 1-hit kills. Enemies dodge under foot shadows, wear helmets, split into multiple pieces, drop armor, or punish naive stomp spammers.
3. **Footwear Mastery**: A locker full of distinct shoes, boots, slippers, and skates—each transforming movement speed, stomp radius, special abilities, and interactions with specific bug types.
4. **Kid-Friendly Cartoon Humor**: Bright, high-contrast art style, googly-eyed insects, silly death reactions, and customizable juice colors (including a non-gory "Neon Slime Mode" for younger/sensitive players).

---

## 2. Target Audience & Safety Guidelines

### 2.1 Demographics & Play Habits (Ages 6–15)
* **Ages 6–9**: Focus on immediate tactile fun, simple tap controls, vibrant colors, unlocking funny slippers (e.g., Bunny Slippers), and short 1-minute arcade bursts.
* **Ages 10–15**: Focus on combo multipliers, perfectionist 3-star level ratings, gear optimization, boss fight strategy, high-score leaderboards, and twitch-reaction dodges.

### 2.2 Safety & Tone Regulations
* **Visuals**: Zero realistic gore or blood. All insect fluids are rendered as vibrant slime, jam, neon ooze, or confetti.
* **Options Toggle**: "Juice Style" settings allow switching between **Cartoon Ooze** (default colorful slime), **Confetti & Candy** (piñata style), and **Bubble Pop** (soap bubbles).
* **Kid-Safe Monetization**: No aggressive paywalls, loot boxes, or deceptive dark patterns. Unlocks are earned strictly through gameplay achievements, stars, and level progression.

---

## 3. Player Character & Foot Mechanics

### 3.1 Perspective & Camera
* **Viewpoint**: Pure 2D top-down overhead perspective looking directly down onto floors, picnic tables, garden grass, and kitchen tiles.
* **Player Representation**: Only the bottom of the shoe/foot (and lower leg/ankle) is visible when hovering and stomping.
* **Target Cursor**: The player controls the position of the foot. A dynamic **Foot Shadow** projects onto the ground below, giving visual cues on height, stomp radius, and landing timing.

### 3.2 Core Movement & Stomp Mechanics

| Mechanic | Input Action | Description & Execution | Strategy / Gameplay Role |
| :--- | :--- | :--- | :--- |
| **Hover / Shadow Track** | Drag Finger / Mouse Move / Thumbstick | Moves the shadow cursor across the floor. Shadow shrinks as foot descends. | Telegraphed to fast bugs; fast bugs react if shadow lingers over them too long. |
| **Quick Tap Stomp** | Tap Screen / Click / RT Button | Rapid down-and-up stomp. Low recovery delay. | Ideal for fast single-hit bugs (Ants, Fleas) and maintaining high combo chains. |
| **Heavy Impact Slam** | Hold & Release / Double Tap | Foot raises higher and slams down with huge shockwave radius. | Cracks heavy armor, stuns adjacent enemies, breaks crates; has a 1-second recovery animation. |
| **Slide / Skater Drag** | Stomp + Drag across screen | Foot lands and slides along the floor, crushing bugs in a line. | Requires specialized shoes (Roller Skates / Ice Skates) or slippery surfaces (Honey/Butter). |
| **Heel Click / Pivot Spin** | Double-tap in place | Heel stays fixed while toe sweeps in a 360° circle. | Sweeps away tiny surrounding swarms in panic situations. |

---

## 4. Footwear System & Progression Loadout

Players unlock and upgrade various shoes in the **Locker Room**. Each shoe alters stats and introduces active/passive perks:

```
                          [ SHOE STAT MATRIX ]
+-------------------+-------------+---------------+---------------+--------------------+
| Shoe Type         | Speed (1-5) | Impact Radius | Armor Piercing| Unique Ability     |
+-------------------+-------------+---------------+---------------+--------------------+
| Classic Sneaker   |     3       |      Medium   |     Low       | Balanced All-Round |
| Steel-Toed Boot   |     1       |      Huge     |     MAX       | Crushes Spikes     |
| Bunny Slipper     |     5       |      Small    |     Zero      | Silent Footsteps   |
| Roller Skate      |     4       |      Narrow   |     Medium    | Continuous Drag    |
| Cleat Boot        |     3       |      Small    |     High      | Punctures Shells   |
| Electric Sock     |     4       |      Medium   |     Low       | Static Shock Wave  |
+-------------------+-------------+---------------+---------------+--------------------+
```

### 4.1 Detailed Footwear Profiles
1. **Classic Sneaker (Starter)**:
   * *Passive*: Standard balance. High responsiveness.
   * *Juice Effect*: Classic squeaky rubber sound, square squeegee splat.
2. **Steel-Toed Work Boot**:
   * *Passive*: Immune to Spiky Caterpillars and Cactus Hazards. Heavy stomps create a shockwave that stuns bugs in a 3-tile radius.
   * *Trade-off*: Slow movement speed and longer stomp cooldown.
3. **Bunny Slippers (Stealth)**:
   * *Passive*: "Silent Tread" — Fast dodging bugs (Fleas, Crickets) do NOT detect the hover shadow until impact.
   * *Trade-off*: Cannot damage Armored Beetles without multiple consecutive hits.
4. **Roller Skates (Speed Drag)**:
   * *Passive*: Enables the "Roll-Over" mechanic—swipe across the screen to roll in a line, squishing weak bugs sequentially without lifting the foot.
   * *Juice Effect*: Leaves continuous tire-track splat lines across the board.
5. **Electric Athletic Sock**:
   * *Passive*: Building up distance generates static electricity. Releasing a stomp triggers a chain-lightning shock that hits adjacent bugs.

---

## 5. Insect & Target Bestiary (Enemies)

To maintain depth and variety, insects feature distinct behaviors, health bars, movement patterns, and evasion mechanics.

```
       [ INSECT BEHAVIOR & COUNTER SYSTEM ]

     [ BASIC ANT ] ---------> Quick Tap ----------> [ 1-Hit Splat ]
          |
     [ BEETLE ] ------------> Heavy Slam ---------> [ Armor Crack -> Splat ]
          |
     [ FLEA/CRICKET ] ------> Feint / Stealth ----> [ Dodge Prediction ]
          |
     [ CENTIPEDE ] ---------> Multi-Segment -------> [ Segment Cut Stomp ]
          |
     [ SPIKY CATERPILLAR ] -> Steel Boot / Cleat --> [ Counter Risk ]
```

### 5.1 Enemy Taxonomy & Mechanics

#### 1. Worker Ant (Tier 1 - Swarm / Fodder)
* **HP**: 1
* **Behavior**: Marches in straight predictable lines along sugar trails or toward fruit objectives.
* **Juice Factor**: Bright neon-green / red splat, pops cleanly with satisfying high-pitch squish.
* **Role**: Combo builder and gauge filler.

#### 2. Armored Rhinoceros Beetle (Tier 2 - Heavy)
* **HP**: 3 (Phase 1: Shell intact; Phase 2: Cracked Shell; Phase 3: Total Splat)
* **Behavior**: Slow, steady movement. Shrugs off light tap stomps (causes a ricochet "CLANG" sound).
* **Mechanic**: Requires a **Heavy Impact Slam** or **Steel-Toed Boot** to crack open. On Phase 2, its internal goo is exposed and squishes violently on the next hit.

#### 3. Ninja Flea / Grasshopper (Tier 2 - Agile / Dodger)
* **HP**: 1
* **Behavior**: Senses the **Foot Shadow**. When the shadow enters its perimeter, a quick "ALERT!" icon appears over its head, and it leaps 3 inches away after 0.25 seconds.
* **Counter Strategy**:
  * *Feint Stomp*: Hover near it to trigger the jump, then stomp where it lands.
  * *Bunny Slippers*: Eliminates shadow warning visual.
  * *Slide Stomp*: Catch it mid-landing with a sliding boot.

#### 4. Multi-Segment Centipede (Tier 3 - Tactical)
* **HP**: 6 (1 HP per body segment)
* **Behavior**: Wiggles in serpentine paths across the screen at high speeds.
* **Mechanic**: Stomping the middle severs the centipede into two smaller independent centipedes that head toward screen edges.
* **Strategy**: Stomp head-first to kill instantly, or segment by segment to maximize combo points.

#### 5. Spiky Woolly Bear Caterpillar (Tier 3 - Hazard / Punisher)
* **HP**: 1
* **Behavior**: Crawls lazily.
* **Mechanic**: Stomping with soft shoes (Sneakers, Socks, Slippers) causes the foot to take damage/knockback ("OUCH!"), resetting the active combo multiplier.
* **Counter**: Stomp using **Steel-Toed Boots** or hit with an environmental hazard (e.g., rolling pin, water drop).

#### 6. Stink Bug (Tier 2 - Disrupter)
* **HP**: 1
* **Behavior**: Wanders slowly.
* **Mechanic**: If stomped directly, releases a purple haze cloud that obscures vision and slows foot movement for 3 seconds.
* **Counter**: Bait near fire hydrants/fans or use precision Cleat punctures.

#### 7. Golden Piñata Fly (Bonus Target)
* **HP**: 5 (Rapid Taps)
* **Behavior**: Zips around frantically in zig-zag patterns.
* **Reward**: Drops shiny coins and explodes into multi-colored candy/confetti splats.

---

## 6. Core Gameplay Systems & Depth Mechanics

### 6.1 Combo System ("Splat Chain")
* **Mechanic**: Stomping bugs within **1.5 seconds** of each other builds the Combo Multiplier (x2, x3, x5, x10... MAX x50).
* **Visual Polish**: With each combo tier, screen shake increases slightly, and comic text pop-ups appear (*SQUISH!*, *CRUNCH!*, *ULTRA SPLAT!*).
* **Reset Condition**: Missing a stomp completely (hitting bare floor) or taking damage from a Spiky Caterpillar resets the combo counter to zero.

### 6.2 The Juice Meter & Splat Fever Mode
* **Juice Meter**: A vertical vial on the HUD fills with squished insect ooze as targets are stomped.
* **Splat Fever Activation**: When full, tapping the **FEVER BUTTON** triggers a 10-second frenzy mode:
  * Foot transforms into a colossal **Gilded Boot of Destruction**.
  * All stomps produce screen-clearing shockwaves.
  * Armored and Spiky bugs are instantly squished on impact.
  * Disco lights and energetic upbeat music play.

```
       [ SQUISH ] ---> Fill Juice Vial ---> [ TRIGGER FEVER ] ---> [ SCREEN SHOCKWAVE ]
```

### 6.3 Environmental Mechanics & Interactive Hazards

| Hazard / Prop | Interaction Mechanism | Effect on Bugs |
| :--- | :--- | :--- |
| **Honey / Syrup Puddles** | Foot steps on edge or bugs walk into it. | Traps bugs in place, making agile fleas unable to jump. Foot slides slightly. |
| **Kitchen Magnets / Metal Traps**| Heavy stomp triggers switch. | Attracts armored beetles to one central point for a multi-squish setup. |
| **Salt Shakers / Soap Bottles** | Stomp on bottle/shaker. | Causes salt/soap to burst outward, dissolving slimes and forcing bugs into panic sprint. |
| **Lawn Mower / Ceiling Fan** | Periodic moving hazard across screen. | Timed crushing zone; bugs pushed into path are sliced into instant juice. |

---

## 7. Level Design & Progression Framework

### 7.1 Stage Environments & Themes
1. **The Picnic Blanket (World 1 - Kitchen & Garden)**: High sugar density, ants, flies, picnic tables, breadcrumbs, syrup traps.
2. **The Overgrown Backyard (World 2 - Nature)**: Tall grass obscuring vision, caterpillars, beetles, muddy sliding paths.
3. **The Dusty Attic (World 3 - Mystery)**: Cobwebs that slow the foot, centipedes, nocturnal glowing moths, trick flooring.
4. **The Neon Arcade Floor (World 4 - Tech/Cyber)**: Slippery linoleum, sticky soda spills, mechanical robo-bugs, rapid conveyor belts.

### 7.2 Level Structure & Star Rating System
Each level is designed for 1-minute to 3-minute play sessions and rewards 1 to 3 Stars based on objectives:

```
[ LEVEL 2-4 OBJECTIVES ]
⭐ Objective 1: Clear 40 Ants & 10 Beetles before time runs out (120s).
⭐⭐ Objective 2: Reach a 15x Splat Combo.
⭐⭐⭐ Objective 3: Complete level without taking spike damage from Caterpillars.
```

### 7.3 Boss Encounters
Every world ends with an epic multi-stage Boss Fight featuring massive mutated boss insects:

#### World 1 Boss: "Goliath Queen Ant"
* **Phase 1**: Queen moves across screen spawning swarms of worker ants. Stomp her body 5 times while avoiding spawned guards.
* **Phase 2**: Queen drops egg sacs across the table. Player must stomp egg sacs before they hatch into armored guards while Queen attempts to bite the foot.
* **Phase 3**: Enraged Queen charges back and forth. Player must time a Heavy Impact Slam on her head during her charge wind-up.

---

## 8. Visual & Audio Design ("The Juice")

### 8.1 Visual Pipeline & Splat Physics
* **Particle Splatter Engine**: When an insect is crushed, a dynamic 2D splatter decal is generated on the floor geometry.
  * Splat decal size is procedurally scaled based on foot speed and insect mass.
  * Splat color matches insect color (Ants = Magenta/Red, Beetles = Emerald Green, Bees = Bright Yellow).
* **Googly Eye & Shell Physics**: Small physics-based rigidbodies (eyeballs, armor shards, wings) shoot outward from the impact center and bounce/settle on the floor.
* **Screen Shake & Zoom**: Micro screen shakes on normal stomps; heavy directional zoom-and-shake on Boss kills and 20+ combos.

```
+-----------------------------------------------------------------------+
|                        VISUAL JUICE PIPELINE                          |
|                                                                       |
| [ FOOT IMPACT ]                                                       |
|       |                                                               |
|       +---> 1. Deform/Squish Sprite Scale (0.1x Y-scale, 1.5x X-scale)|
|       +---> 2. Spawn Radial Ooze Particle Burst                       |
|       +---> 3. Apply Decal Stamp to Floor Canvas (Persistent)         |
|       +---> 4. Eject Googly Eyes & Armor Fragments (Physics Rigidbodies)|
|       +---> 5. Pop Comic Text ("SPLAT!") with Spring Scaling          |
|       +---> 6. Camera Micro-Shake & Impulse Haptic Feedback           |
+-----------------------------------------------------------------------+
```

### 8.2 Sound Design Matrix
* **Primary Stomp Sounds**:
  * *Sneaker*: Punchy rubber squeak followed by wet squelch.
  * *Boots*: Heavy metallic thud followed by explosive crunch.
  * *Flip-Flop*: Sharp, loud slap!
* **Squish Layering**: 3-layer audio system per stomp:
  1. *Impact Layer*: Hard punch/thud sound.
  2. *Juice Layer*: Wet squelch/pop (varied pitch by bug size).
  3. *Debris Layer*: Cracking shell/crunch accent.
* **Adaptive Music**: Dynamic background track speeds up as Combo Multiplier rises, shifting into high-tempo chiptune/funk during Fever Mode.

---

## 9. UI/UX & Controls

### 9.1 HUD Layout (In-Game Screen)

```
+-----------------------------------------------------------------------+
| [SCORE: 045,200]    [COMBO: x12 🔥]          [TIME: 01:15]    [PAUSE] |
|                                                                       |
|  (Vial)                                                               |
| [JUICE]                                                               |
| [==== ]                                                               |
| [==== ]                                                               |
| [FEVER]                                                               |
|                                                                       |
|                            [ Foot Shadow ]                            |
|                              ( O )                                    |
|                                                                       |
|               ~ ant ~       ~ beetle ~        ~ ant ~                 |
|                                                                       |
|                                                                       |
| [ACTIVE PERK: STEEL BOOT]                        [SHOE SWAP BUTTON]   |
+-----------------------------------------------------------------------+
```

### 9.2 Control Schemes
* **Mobile (Touch)**: Direct finger tracking for movement; tap to stomp; dual-finger pinch or active button for shoe special power.
* **PC (Mouse & Keyboard)**: Mouse moves shadow cursor; Left Click = Quick Stomp; Right Click = Heavy Slam; Spacebar = Fever Mode.
* **Console / Switch**: Left Thumbstick = Move Foot Shadow; A Button = Quick Stomp; ZR Trigger = Heavy Slam; X Button = Fever Mode.

---

## 10. Monetization, Retention & Accessibility

### 10.1 Kid-Friendly Progression & Rewards
* **Shoe Locker Unlockables**: Earned via Star Progression or In-Game Coins collected during Piñata levels.
* **Splat Cosmetics**: Unlock custom goo colors (Rainbow Slime, Sparkle Glitter, Gold Dust) and shoe skins (Dragon Feet, Robo Shoes, Glowing Neon Soles).
* **Daily Clean-Up Challenges**: "Squish 100 Ants", "Complete Level 3 without missing a stomp", "Reach x20 combo with Bunny Slippers".

### 10.2 Accessibility Options
* **Splat Style Selector**: Toggle between *Cartoon Slime*, *Confetti Piñata*, or *Bubble Pop* for squeamish players.
* **Shadow Radius Indicator High-Vis**: Scalable indicator ring for players with visual impairments.
* **Single-Tap Mode**: Auto-tracks nearest bug on tap for young players (Ages 6-7) who struggle with dual-stick/precise drag inputs.

---

## 11. Technical Specifications & Performance

### 11.1 Decal Management & Rendering
* **Texture Pooling**: Splat decals are baked onto a dynamic floor render-texture to maintain constant 60 FPS performance without lagging devices when hundreds of splats cover the board.
* **Object Pooling**: Pre-instantiated pools for bug entities, splash particle systems, and floating comic text pop-ups.

### 11.2 Entity Budget
* **Max Active Bugs on Screen**: 150 simultaneous entities.
* **Target Frame Rate**: 60 FPS on mobile devices (iPhone 11 / Android equivalents and Nintendo Switch).

---

## 12. Development Roadmap & Milestones

```
+-----------------------------------------------------------------------+
|                          DEVELOPMENT ROADMAP                          |
+-----------------------------------------------------------------------+
| [PHASE 1: CORE PROTOTYPE]                                             |
|  - Foot physics, Shadow indicator, Tap & Heavy Stomp controls         |
|  - 3 Basic Bug Types (Ant, Beetle, Flea with dodge AI)                |
|  - Particle Splatter engine & decaling prototype                      |
+-----------------------------------------------------------------------+
| [PHASE 2: CONTENT & SHOE SYSTEM]                                      |
|  - Implement 6 Shoe Types & Locker Progression UI                     |
|  - Add Centipedes, Spiky Caterpillars, Stink Bugs                     |
|  - Implement Combo & Fever Mode Systems                               |
+-----------------------------------------------------------------------+
| [PHASE 3: WORLD BUILD & BOSS ENCOUNTERS]                              |
|  - 4 Worlds (40 Levels total + 4 Boss Fights)                         |
|  - Audio layer polish (3-layer squish sounds, dynamic music)          |
|  - Accessibility toggles & Kid-Safe UI Polish                         |
+-----------------------------------------------------------------------+
| [PHASE 4: TESTING & LAUNCH]                                           |
|  - Kid focus group testing (Ages 6-9 and 10-15 cohorts)               |
|  - Performance optimization (Decal texture baking, memory pooling)    |
|  - Soft Launch & Global Release                                       |
+-----------------------------------------------------------------------+