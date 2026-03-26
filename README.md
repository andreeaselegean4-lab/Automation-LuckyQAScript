# Automation Test Suite Documentation — Rock & Riches

This document explains every test suite and individual test in the project. Written in plain English for anyone — no coding experience required.

---

## Table of Contents

1. [Smoke Tests](#1-smoke-tests)
2. [Spin Cycle Tests](#2-spin-cycle-tests)
3. [Bet Controls Tests](#3-bet-controls-tests)
4. [Autoplay Tests](#4-autoplay-tests)
5. [Turbo Mode Tests](#5-turbo-mode-tests)
6. [API Contract Tests](#6-api-contract-tests)
7. [Endurance Tests](#7-endurance-tests)
8. [Edge Cases Tests](#8-edge-cases-tests)
9. [Hold & Win Bonus Tests](#9-hold--win-bonus-tests)
10. [Responsive Layout Tests](#10-responsive-layout-tests)
11. [Network Interruption Tests](#11-network-interruption-tests)
12. [Session Persistence Tests](#12-session-persistence-tests)
13. [Social Language — Translation File Tests](#13-social-language--translation-file-tests)
14. [Social Language — DOM Scan Tests](#14-social-language--dom-scan-tests)
15. [Social Language — Paytable OCR Tests](#15-social-language--paytable-ocr-tests)
16. [MGA/IOM UI Compliance Tests](#16-mgaiom-ui-compliance-tests)
17. [Rules Accessibility Tests](#17-rules-accessibility-tests)
18. [Rules Content Tests](#18-rules-content-tests)
19. [Balance & Bet Compliance Tests](#19-balance--bet-compliance-tests)
20. [IOM-Specific Compliance Tests](#20-iom-specific-compliance-tests)
21. [Jackpot Rules Compliance Tests](#21-jackpot-rules-compliance-tests)
22. [Plain Language & Prize Disclosure Tests](#22-plain-language--prize-disclosure-tests)

---

## 1. Smoke Tests

**File:** `01-smoke.spec.ts`
**Suite:** `Smoke Tests — Verify Game Loads Correctly and All Critical UI Elements Are Present`

These are the very first tests that run. They check that the game starts up properly and all the important buttons and displays are visible on screen. Think of it as a quick health check before testing anything else.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Game loads without console errors | The game starts up without any hidden technical errors in the browser | Hidden errors could mean broken features that aren't immediately visible |
| Spin button is visible and enabled | The main "Spin" button appears and can be clicked | If the spin button is missing or greyed out, the player can't play at all |
| Autoplay button is visible | The "Autoplay" button appears on screen | Players need this to set up automatic spins |
| Bet controls are visible | The bet increase, decrease buttons and bet display all appear | Players need to see and adjust their bet before playing |
| Balance shows a positive number | The player's balance is displayed and isn't zero or negative | A missing or incorrect balance means the player can't know how much money they have |
| Initial bet is a positive number | The starting bet amount is a real number above zero | A zero or missing bet would break the spin functionality |
| Loading screen is dismissed | The loading/splash screen goes away after the game initialises | A stuck loading screen means the player can never reach the game |
| Menu button is visible | The settings/menu button appears in the UI | Players need access to game settings and information |
| Turbo toggle is visible | The fast-play speed button appears in the UI | Players need the option to speed up gameplay |
| Last-win display shows zero | The "last win" area exists and shows zero before any spin | This display needs to be ready to show win amounts after spins |
| Page has a title | The browser tab has a title set | Required for accessibility and helps players identify the game tab |

---

## 2. Spin Cycle Tests

**File:** `02-spin-cycle.spec.ts`
**Suite:** `Spin Cycle — Verify Spin State Transitions, API Calls, and Balance Deduction`

These tests verify the core gameplay loop — pressing spin, watching the reels, and getting a result. They make sure the game goes through the correct steps in the right order and that money is handled correctly.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Spin button disables during spin, re-enables after | The spin button greys out while reels are spinning, then becomes clickable again | Prevents players from accidentally triggering multiple spins at once |
| All controls disabled during spin | Bet, autoplay, and menu buttons are locked while spinning | Changing settings mid-spin could cause unpredictable behaviour |
| All controls re-enabled after spin | Everything becomes clickable again once the spin finishes | If controls stay locked, the player is stuck and can't do anything |
| Each spin triggers exactly one API call | Pressing spin sends exactly one request to the server | Multiple requests could deduct the bet more than once |
| Spin response contains valid data | The server's response includes all required fields (payload, display, bet) | Missing data would mean the game can't show results properly |
| Balance decreases by bet amount on no-win | When you don't win, your balance drops by exactly your bet | If the deduction is wrong, the player is being overcharged or undercharged |
| Winning spin credits correctly | A win deducts the bet, adds the winnings, and updates the "Last Win" display | If wins aren't credited properly, players lose money they should have won |
| Last Win display matches API | The win amount shown on screen matches what the server calculated | A mismatch means the display is lying to the player |
| Double-click fires only one spin | Rapidly clicking spin twice only triggers one spin, not two | Prevents accidental double-bets which would frustrate players |
| Three consecutive spins complete cleanly | Three spins in a row all work without errors | Ensures the game doesn't break after repeated use |

---

## 3. Bet Controls Tests

**File:** `03-bet-controls.spec.ts`
**Suite:** `Bet Controls — Verify Bet Increase, Decrease, Limits, and API Sync`

These tests make sure that players can change their bet amount and that those changes are properly communicated to the server.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Increase button raises bet | Clicking "+" makes the bet go up | Players need to be able to raise their bet |
| Decrease button lowers bet | Clicking "-" makes the bet go down | Players need to be able to lower their bet |
| Bet caps at maximum | Clicking "+" many times stops at the max bet, not beyond | Prevents players from accidentally betting more than allowed |
| Bet floors at minimum | Clicking "-" many times stops at the min bet, not below | Prevents invalid zero or negative bets |
| Increased bet sent to server | After raising the bet, the next spin uses the new higher amount | If the server uses the old bet, the player's display and actual bet don't match |
| Decreased bet sent to server | After lowering the bet, the next spin uses the new lower amount | Same reason — what you see should be what you bet |
| Bet buttons disabled during spin | Can't change bet while reels are spinning | Changing bet mid-spin could cause accounting errors |
| Bet buttons re-enabled after spin | Bet controls unlock once spin finishes | If they stay locked, the player can't change their bet anymore |
| Balance deduction matches new bet | After changing bet, the amount taken from balance matches the new bet | Ensures the actual money deducted matches what the player chose |

---

## 4. Autoplay Tests

**File:** `04-autoplay.spec.ts`
**Suite:** `Autoplay — Verify Automatic Spin Sessions, Stop Behaviour, and Balance Tracking`

Autoplay lets the game spin automatically without the player pressing the button each time. These tests make sure it starts, runs, and stops properly.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Autoplay starts and disables spin button | Pressing autoplay begins automatic spins and locks manual spin | Prevents conflicts between auto and manual spins |
| At least 5 spins fire automatically | The game completes multiple spins on its own without manual clicks | Autoplay would be useless if it only did one spin |
| Stopping autoplay re-enables spin button | After stopping autoplay, the manual spin button works again | If the button stays locked, the player is stuck |
| Controls disabled during autoplay | Bet and other buttons are locked while autoplay is running | Changing settings during autoplay could cause unpredictable results |
| Balance change matches bets and wins | The total balance change over the autoplay session adds up correctly | Ensures no money is lost or created out of thin air during autoplay |
| No errors during autoplay session | The entire autoplay session runs without any hidden technical errors | Hidden errors could mean wins are being skipped or calculated wrong |
| Autoplay continues after a win | Getting a win doesn't stop the autoplay session | Players expect autoplay to keep going unless they stop it themselves |

---

## 5. Turbo Mode Tests

**File:** `05-turbo.spec.ts`
**Suite:** `Turbo Mode — Verify Fast-Play Toggle, Spin Behaviour, and State Persistence`

Turbo (fast-play) mode speeds up the reel animations. These tests make sure it works correctly without affecting the actual game results.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Turbo button visible, defaults to regular | The speed button appears and starts in normal speed mode | Players need to find and understand the speed control |
| Enabling turbo changes button style | Turning turbo on visually changes the button to show it's active | Players need visual feedback that turbo mode is on |
| Disabling turbo reverts button style | Turning turbo off changes the button back to normal | Players need to know when they're back in normal speed |
| Toggling multiple times doesn't break anything | Switching turbo on and off repeatedly still works fine | Rapid toggling shouldn't crash or confuse the game |
| Turbo doesn't change bet value | Enabling fast-play doesn't accidentally alter how much you're betting | Speed mode should only affect animation, not money |
| Turbo doesn't double-fire spins | Fast mode still sends exactly one server request per spin | Even at high speed, each spin should only count once |
| Spin data is valid in turbo mode | The server request and response are correct during fast play | Speed changes shouldn't corrupt the data being sent or received |
| Balance deduction correct in turbo | Money is deducted properly even during fast play | Faster animations shouldn't cause accounting errors |
| Turbo stays active across spins | Fast mode doesn't turn itself off after each spin | Players expect turbo to stay on until they turn it off |
| No errors during turbo spins | Three fast spins complete without any hidden errors | Speed mode shouldn't introduce new technical problems |
| Turbo speed constant is correct | The internal speed multiplier matches the expected value (1.5x) | Ensures the game actually runs faster, not at normal speed |

---

## 6. API Contract Tests

**File:** `06-api-contract.spec.ts`
**Suite:** `API Contract — Verify Server Response Schema, Display Matrix, and Win Data Integrity`

These tests verify the raw data coming back from the game server. They check that every piece of information the server sends is structured correctly and makes logical sense.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Spin returns HTTP 200 | The server responds with a success status code | A non-200 response means something went wrong on the server |
| Response contains a payload | The server's reply has a main data section called "payload" | Without this, the game has no spin results to display |
| Display is a 5x3 matrix of valid symbols | The reel display is a grid of 5 columns and 3 rows, each containing a real symbol | This grid is what the player sees — wrong dimensions or invalid symbols break the display |
| Bet fields are positive numbers | The bet amount and value in the response are real positive numbers | Zero or negative bets would indicate a data error |
| Wins array has valid win objects | Each win entry has a positive prize amount, a symbol ID, and a count | Malformed win data could credit wrong amounts or crash the win display |
| Win symbols match the symbol table | Every winning symbol in the response is a real symbol that exists in the game | An unknown symbol ID means the server is referencing something that doesn't exist |
| Payline row indices are valid | Each position in a winning line is within the grid boundaries (0 to 2) | A row index of 5 on a 3-row grid is impossible and indicates a server bug |
| Win count is between 3 and 5 | Winning matches have at least 3 symbols (minimum to win) and at most 5 (total reels) | Fewer than 3 shouldn't pay; more than 5 is physically impossible |
| Nominal matrix matches display size | The alternative number matrix has the same dimensions as the display | Mismatched dimensions would cause rendering errors |
| Response includes session state | The server sends back session data for persistence | Without this, the game can't remember where you left off |
| Request contains a valid bet | The outgoing spin request includes a properly formatted bet | If the bet isn't sent correctly, the server can't process the spin |
| 10 consecutive spins all return valid data | Ten spins in a row all get proper responses from the server | Ensures consistency — not just one lucky response |

---

## 7. Endurance Tests

**File:** `08-endurance.spec.ts`
**Suite:** `Endurance — Verify Stability Over Extended Spin Sessions (Memory, Balance, Errors)`

These are long-running stress tests. They spin the game hundreds of times to check for problems that only appear after extended play — like memory leaks or gradual balance drift.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| 200 spins without errors or memory overflow | The game runs 200 spins without crashing, freezing, or using too much memory | Some bugs only appear after extended play — the game must stay stable for long sessions |
| Memory growth stays under 50% over 100 spins | The game's memory usage doesn't keep growing uncontrollably | A memory leak would eventually crash the browser after enough spins |
| Balance matches expected value after 100 spins | The displayed balance after 100 spins matches the mathematically expected value | Even tiny rounding errors add up over many spins — this catches balance drift |
| Game recovers from a 2-second delay | The game handles a slow server response without breaking | Real-world network conditions aren't always perfect |

---

## 8. Edge Cases Tests

**File:** `10-edge-cases.spec.ts`

### Suite A: Mock Response Tests
**Suite:** `Edge Cases — Verify Game Behaviour With Mocked Spin Outcomes (Jackpot, No-Win, Bonus)`

These tests use fake (mocked) server responses to force specific outcomes and check that the game handles each one correctly.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Grand jackpot credits correctly | A forced jackpot win adds the right amount to the balance | The biggest wins must be calculated and displayed correctly |
| No-win deducts bet exactly | A forced loss takes exactly the bet amount, no more, no less | Even losses must be accounted for precisely |
| Last Win shows correct amount | The win display matches the forced win amount | Players must see accurate win information |
| Bonus trigger doesn't crash | Forcing a Hold & Win bonus doesn't cause errors | Bonus transitions are complex — they must not break the game |
| Free spins trigger doesn't crash | Forcing free spins doesn't cause errors | Free spin triggers involve UI changes that could fail |
| Three queued results fire in order | Three pre-set outcomes happen in the correct sequence (first, second, third) | Ensures the mock system is reliable and outcomes aren't scrambled |

### Suite B: Debug Trigger Tests
**Suite:** `Edge Cases — Verify Debug Trigger Scenarios (Jackpot, Near-Miss, Bonus, Free Games)`

These tests use the game's built-in debug tools to trigger special scenarios.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Grand Jackpot produces large win | The debug jackpot trigger gives a win larger than the minimum jackpot tier | Confirms the jackpot system actually awards big prizes |
| Near-miss shows anticipation but no jackpot | The "almost won a jackpot" animation plays but no prize coins land | Near-misses must look exciting without falsely awarding prizes |
| Coin bonus triggers Hold & Win | The debug bonus trigger correctly starts the Hold & Win mini-game | The bonus entry must work without errors |
| Free games trigger correctly | Debug free spins start properly with the right number of remaining spins | Free spins are a major feature and must launch correctly |
| All-jackpots-in-free-games produces a win | Triggering jackpots during free spins produces at least one win | This complex scenario (jackpots inside free games) must work |
| Bonus-with-payline fires both | A combined bonus and payline win both register without errors | When two win types happen simultaneously, both must work |

---

## 9. Hold & Win Bonus Tests

**File:** `11-bonus-trigger.spec.ts`

### Suite A: Bonus Constants
**Suite:** `Bonus Constants — Verify Collector Coin, Thresholds, and Jackpot Multiplier Values`

These tests verify that the game's bonus configuration values are correct.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Collector coin ID equals 10 | The special collector coin symbol has the correct internal ID | A wrong ID means the game won't recognise collector coins |
| Collection thresholds are correct | The bonus progression stages match expected values [0, 1, 15, 30, 50] | Wrong thresholds mean the bonus triggers at the wrong times |
| Jackpot multipliers are correct | Mini=25x, Minor=50x, Major=250x, Grand=5000x | Wrong multipliers mean jackpot prizes are incorrect |

### Suite B: Bonus Lifecycle
**Suite:** `Hold & Win Bonus Lifecycle — Verify Trigger, Transition, Award, and Return to Idle [debug]`

These tests walk through the entire bonus mini-game from start to finish.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Bonus transition has no errors | Entering the Hold & Win mini-game doesn't cause technical errors | The transition animation is complex and could fail |
| Game returns to idle after bonus | After the bonus ends, the game goes back to normal with the spin button ready | If the game gets stuck in bonus mode, the player can't continue |
| Bonus awards a positive win | The bonus mini-game gives the player some winnings and the balance is correct | The whole point of the bonus is to win something |
| Grand Jackpot bonus completes cleanly | The biggest jackpot scenario runs and finishes without errors | This is the most exciting moment in the game — it must work |

### Suite C: Mock Bonus
**Suite:** `Hold & Win Bonus — Verify Bonus Entry and Recovery Using Mocked Payloads [mock]`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Mocked bonus entry has no errors | A fake bonus trigger doesn't crash the game | Tests the bonus animation pathway independently |
| Game recovers after bonus mock | After a fake bonus trigger, normal spins still work | The game must return to a working state after bonus sequences |

---

## 10. Responsive Layout Tests

**File:** `12-responsive.spec.ts`

**Suites:** One suite per screen size — iPhone SE (375x667), iPhone 14 Pro (393x852), iPad Mini (768x1024), iPad Pro Landscape (1194x834), Laptop (1280x720), Full HD (1920x1080)

These tests resize the browser window to match different devices and check that the game still looks and works correctly on each one.

| Test (repeated per device) | What It Checks | Why It Matters |
|------|---------------|----------------|
| Game loads without errors | The game starts up properly at this screen size | Some layouts break on certain screen sizes |
| Spin button is visible | The spin button can be seen and reached | If the spin button is off-screen, the player can't play |
| Balance display is visible | The balance area is on screen | Players must always see their balance |
| Balance shows a positive number | The balance reads correctly, not garbled text | Layout issues could corrupt the displayed numbers |
| Full spin cycle works | A complete spin works from start to finish | The game must be fully playable at every screen size |
| No horizontal scrollbar | The page fits within the screen width | Horizontal scrolling is a sign of broken layout |
| Bet value is readable | The bet amount is visible and shows a real number | Tiny screens must still display bet information clearly |

---

## 11. Network Interruption Tests

**File:** `13-network-interruption.spec.ts`
**Suite:** `Network Interruption — Verify Game Recovery From Aborts, Delays, 500 Errors, and Disconnects`

These tests simulate bad internet conditions to make sure the game handles them gracefully instead of crashing.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Recovers from aborted connection | The game handles a suddenly dropped connection without crashing | Real players experience dropped connections all the time |
| Handles 10-second delay | The game waits patiently for a very slow server response | Slow networks shouldn't crash the game |
| Handles server error (HTTP 500) | The game survives a server error without losing the player's balance | Server errors happen — the game must protect the player's money |
| Handles malformed response | A garbled server response doesn't cause an unrecoverable crash | Corrupted data shouldn't take down the whole game |
| Recovers after 3 consecutive failures | The game works again after three failed attempts in a row | Even repeated failures shouldn't permanently break the game |
| Autoplay stops on disconnect | Autoplay gracefully stops when the connection is lost | Autoplay shouldn't keep trying to spin when there's no internet |

---

## 12. Session Persistence Tests

**File:** `14-session-persistence.spec.ts`
**Suite:** `Session Persistence — Verify Balance, Bet, and Game State Survive Page Reloads`

These tests reload the page to make sure the player's progress isn't lost.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Balance restored after reload | The player's money is the same after refreshing the page | Players would be furious if a page refresh changed their balance |
| Custom bet level persists | A bet amount the player chose is remembered after reload | Having to re-set your bet every time is a bad experience |
| No errors after reload | The page reloads without any hidden technical errors | Errors after reload could mean corrupted game state |
| Spin works after reload | A spin completes normally after refreshing the page | The game must be fully functional immediately after reload |
| Game loads into base state | After reload, the game is in normal mode with all controls ready | The game shouldn't reload into a broken or locked state |
| Full navigation restores session | Navigating completely away and back restores the session | Even leaving the page entirely shouldn't lose progress |
| Three reloads don't corrupt anything | Three page refreshes in a row don't cause balance errors | Repeated reloads shouldn't gradually corrupt the game state |

---

## 13. Social Language — Translation File Tests

**File:** `15-social-language.spec.ts`

These tests check that the social (non-gambling) versions of the game don't accidentally contain real-money gambling terminology in their translations.

### CDN File Availability
Checks that translation files for English, Spanish, and German social locales exist and can be downloaded from the server.

### Per-Language RMG Term Scanning (English, Spanish, German)

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Translation file is parseable | The language file can be read and contains at least 4 entries | A broken file means the game can't display text in that language |
| No forbidden RMG terms | No real-money gambling words appear in any translation | Social versions must not reference real money to comply with regulations |
| No high-risk RMG terms | Specifically dangerous words (bet, cash, payout, gamble, etc.) are absent | These words could cause the social version to be flagged or rejected by app stores |

### Compliance Summary Report
Generates a full report scanning all social languages for any violations.

---

## 14. Social Language — DOM Scan Tests

**File:** `16-social-language-dom.spec.ts`

These tests load the actual game in social mode and scan all visible text on screen for forbidden gambling terms — catching text that might be hardcoded in the game rather than coming from translation files.

| Test (per locale) | What It Checks | Why It Matters |
|------|---------------|----------------|
| No RMG terms in main game UI | The visible game screen has no gambling language | Even if translations are clean, hardcoded text could contain gambling terms |
| No RMG terms in menu/paytable | The settings menu and paytable have no gambling language | These panels often contain descriptions that could include forbidden terms |

Also generates a full compliance summary report across all locales.

---

## 15. Social Language — Paytable OCR Tests

**File:** `17-social-language-paytable-ocr.spec.ts`

These tests use optical character recognition (OCR) to read text that's rendered inside the game's graphics engine (WebGL canvas). Regular text scanning can't see this text because it's drawn as an image, not as HTML text.

| Test (per locale) | What It Checks | Why It Matters |
|------|---------------|----------------|
| No RMG terms in WebGL paytable text | Text rendered inside the paytable graphics contains no gambling terms | This catches forbidden text that's invisible to DOM-based scanning |

Also generates a full OCR compliance summary report across all locales.

---

## 16. MGA/IOM UI Compliance Tests

**File:** `20-ui-compliance.spec.ts`
**Suite:** `MGA/IOM UI Compliance`

These tests verify the game meets Malta Gaming Authority (MGA) and Isle of Man (IOM) regulatory requirements for the user interface.

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Clock visible in HH:MM format | A real-time clock is displayed during gameplay | Regulatory requirement — players must be able to track time spent playing |
| UI text in correct language | Game text is displayed in the appropriate language (English) | Regulatory requirement — players must understand all game text |
| Balance visible before spin | The player's balance is displayed before they start playing | Players must know their balance before placing bets |
| Balance visible after spin | The balance remains visible after a spin completes | Balance must always be visible, not hidden during results |
| Currency denomination shown | The currency (EUR, $, credits) is clearly displayed | Players must know what currency they're playing with |
| Balance, bet, and currency all visible | All financial information is displayed at the same time | Players need a complete financial picture at a glance |
| Demo mode shows same UI | The demo/free version has all the same UI elements | Demo mode must accurately represent the real game |

---

## 17. Rules Accessibility Tests

**File:** `21-rules-accessibility.spec.ts`
**Suite:** `Rules Accessibility`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Info button opens rules | There's a visible button that opens the game rules | Regulators require easy access to game rules |
| Rules accessible before and after spin | The rules can be opened at any point during gameplay | Players must be able to check rules whenever they want |
| Rules accessible without placing a bet | Rules can be viewed without spending any money first | Players should be able to read rules before committing any funds |

---

## 18. Rules Content Tests

**File:** `22-rules-content.spec.ts`
**Suite:** `Rules Content — MGA Requirements`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| RTP percentage documented | The paytable shows the game's Return to Player percentage | Regulatory requirement — players must know their theoretical odds |
| Game configuration references present | Rules mention bet controls, balance, and have multiple pages | Players need comprehensive game information |
| Win calculations documented | The paytable explains how wins are calculated | Players must understand how payouts work |
| Interactive controls present alongside paytable | Spin, bet, and autoplay controls are accessible while viewing rules | Players should be able to play and reference rules simultaneously |
| Sufficient rule pages | At least 3 pages of rules covering wild, scatter, and bonus features | Complex games need thorough documentation |
| Game states documented | Rules explain different game states alongside visible controls | Players must understand what's happening during different game phases |

---

## 19. Balance & Bet Compliance Tests

**File:** `23-balance-bet-compliance.spec.ts`
**Suite:** `Balance & Bet Compliance`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Balance updates in real time | The balance changes immediately when a spin starts | Players must see money deducted instantly, not after a delay |
| Balance visible during and after spin | The balance display never disappears during gameplay | Players must always know their current balance |
| Min and max stakes available | Both minimum and maximum bet options exist, and max is higher than min | Regulatory requirement — players must have a range of betting options |

---

## 20. IOM-Specific Compliance Tests

**File:** `24-iom-extras.spec.ts`
**Suite:** `IOM-Specific Compliance`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Game name visible in page title | The game's name appears in the browser tab | IOM requirement — game must be identifiable at all times |
| Max win documented in paytable | The rules state the maximum possible win | IOM requirement — players must know the biggest possible prize |
| Payout direction illustrated | The paytable shows how winning combinations are formed | IOM requirement — players must understand win patterns |
| Bet placement documented | The rules explain how to place bets | IOM requirement — betting process must be documented |
| Time-critical events documented | The rules cover disconnections and malfunctions | IOM requirement — players must know what happens during interruptions |
| Outcomes determined server-side | Each spin makes a server API call (not calculated locally) | IOM requirement — ensures fairness through server-side random number generation |

---

## 21. Jackpot Rules Compliance Tests

**File:** `25-jackpot-rules.spec.ts`
**Suite:** `Jackpot Rules Compliance`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Jackpot rules documented | The paytable explains how to win the jackpot | Players must understand jackpot mechanics |
| Jackpot tier multipliers listed | All jackpot tier values are documented in the rules | Players must know what each jackpot tier pays |
| Jackpot RTP documented | The jackpot's contribution to overall RTP is stated | IOM requirement — full RTP breakdown must be disclosed |
| Jackpot limits described | Maximum jackpot amounts and multiplier caps are documented | IOM requirement — jackpot limits must be transparent |

---

## 22. Plain Language & Prize Disclosure Tests

**File:** `26-plain-language.spec.ts`
**Suite:** `Plain Language & Prize Disclosure`

| Test | What It Checks | Why It Matters |
|------|---------------|----------------|
| Symbol labels are plain language | Symbols have clear names (e.g., "Diamond", "Crown"), not generic IDs | Players must understand what each symbol represents |
| Loss conditions documented | The rules explain when and how you can lose | Players must understand that not every spin wins |
| All ways to win documented | Paylines and winning combinations are clearly explained | Players must know all the ways they can win |
| Coin and special symbol prizes disclosed | Hold & Win coin values and special symbol prizes are listed | Players must know what bonus symbols are worth |
| Malfunction clause present | The rules include a statement about what happens if the game malfunctions | Regulatory requirement — every game must have this clause |

---

## Running the Tests

```bash
# Run all tests
npx playwright test

# Run a specific test suite
npx playwright test tests/01-smoke.spec.ts

# Run tests and auto-open the report
npm run test:report
```
