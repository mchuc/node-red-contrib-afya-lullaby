# node-red-contrib-afya-lullaby

[![npm](https://img.shields.io/npm/v/node-red-contrib-afya-lullaby)](https://www.npmjs.com/package/node-red-contrib-afya-lullaby)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Node-RED dimmer helper: changes a value **from X to Y in Z seconds**. Made for my children, who like falling asleep with the light on – it dims the light slowly. It also works the other way round, as a slow wake-up light.

**[English](#english) · [Polski](#polski)**

---

## English

The node does not control a lamp itself – it calculates the value. Use `msg.payload.value` for your light.

### Install

```bash
cd ~/.node-red
npm install node-red-contrib-afya-lullaby
```

Requires Node-RED ≥ 3.0 and Node.js ≥ 18. The node appears in the **AFYA** palette group as **lullaby**.

### Configuration

| Field | Description |
|---|---|
| Labels | Language of the descriptions in the edit dialog: *system language* (Polish for a Polish system, English for all others), *English* or *Polski*. Only the descriptions change – fields and values stay the same. |
| **Start value** | Value at the beginning (e.g. 100). |
| **Stop value** | Value at the end (e.g. 0). Start > stop: dimming; start < stop: brightening. |
| **Step** | Change per step (integer > 0). |
| **Time** | Total time in seconds (20 min = 1200). |
| **Variable** | Context variable with the current state – `global` (readable from any flow) or `flow`. |
| **Name** | Optional label. |

### Input

* any message – start (ignored while running),
* `msg.payload = "stop"` or `"kill"` – stop at the current value.

### Start from the current value (`msg.payload`)

Turn on **Start from the number in msg.payload** and send the current value as a number, e.g. the brightness
of the lamp – the change starts from there instead of the configured start value:

* above the stop value – dimming, below – brightening; equal – the node sends `end` at once,
* text, objects and timestamps (a default *inject*) keep the configured start value,
* **Time from there**: *always the time above*, or *same speed* – with 100 → 0 in 20 min, 50 → 0 takes 10 min.

Handy e.g. for a home theatre: dim from the brightness the lights have when the film starts. If the
brightness comes in another property (e.g. `msg.payload.brightness`), move it to `msg.payload` with a
*change* node first.

### Output

```json
{ "value": 57, "state": "counting", "direction": "down", "timestamp": 1764057600000 }
```

`state`: `counting` while running, `end` with the final (stop) value.

The context variable additionally holds `startValue`, `stopValue`, `startTime`, `stopTime` and can have
`state` = `killed` or `stopped` (redeploy).

Example flow: <https://flows.nodered.org/flow/ce2fe16f73fc82e2760eaaadf28991b9>

### Upgrading to 0.1.0

The node was registered under a wrong key in `package.json` (`afya-panic-button`) – fixed, both packages can now
be installed side by side. Older nodes get the context variable when you open and save them.
See [change.log](change.log).

---

## Polski

Zmienia wartość **od X do Y w czasie Z sekund**. Stworzony dla moich dzieci, które lubią zasypiać przy zapalonym
świetle – powoli je wygasza. Działa też w drugą stronę, jako budzenie światłem.

Węzeł nie steruje lampą – tylko liczy wartość. Użyj `msg.payload.value`.

### Instalacja

```bash
cd ~/.node-red
npm install node-red-contrib-afya-lullaby
```

Wymaga Node-RED ≥ 3.0 i Node.js ≥ 18. Węzeł **lullaby** jest w grupie palety **AFYA**.

**Etykiety (Labels)** – język opisów w oknie konfiguracji: *język systemu* (polski dla polskiego systemu, angielski dla każdego innego), *English* albo *Polski*. Zmieniają się tylko opisy – pola i wartości zostają takie same.

### Użycie

* **Start value / Stop value** – od czego do czego (start > stop: gaszenie, start < stop: rozjaśnianie),
* **Step** – zmiana na krok, **Time** – czas w sekundach (20 min = 1200),
* **Variable** – zmienna **global** lub **flow** z bieżącym stanem (dostępna z innych flow),
* dowolna wiadomość uruchamia, `msg.payload = "stop"` lub `"kill"` przerywa,
* **Start from the number in msg.payload** – liczba w `msg.payload` (np. obecna jasność lampy) staje się
  wartością startową; kierunek wynika z niej, a **Time from there** decyduje, czy czas jest zawsze ten sam,
  czy prędkość (krótszy zakres – krócej). Tekst, obiekt i znacznik czasu z *inject* nie zmieniają startu.

Na wyjściu: `{ value, state, direction, timestamp }`, `state`: `counting` lub `end`.

---

Marcin Chuć · [MIT](LICENSE)
